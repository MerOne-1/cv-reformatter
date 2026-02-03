import prisma from '@/lib/db';
import { uploadAudio, deleteFile, getSignedDownloadUrl } from '@/lib/b2';
import { getAudioTranscriptionQueue } from '@/lib/queue';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';
import { NextRequest, NextResponse } from 'next/server';

const paramsSchema = z.object({ id: z.string() });

// Formats audio acceptés (WhatsApp et autres)
const ACCEPTED_AUDIO_TYPES = [
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/webm',
  'audio/aac',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'application/ogg', // Parfois utilisé pour les fichiers OGG
];

// Extensions audio acceptées (pour validation supplémentaire)
const ACCEPTED_AUDIO_EXTENSIONS = [
  '.opus',
  '.ogg',
  '.mp3',
  '.m4a',
  '.wav',
  '.webm',
  '.aac',
  '.oga', // OGG Audio
  '.spx', // Speex
  '.flac',
];

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

// Vérifie si le fichier est un audio valide (par type MIME ou extension)
function isValidAudioFile(file: File): boolean {
  const mimeType = file.type.toLowerCase().split(';')[0].trim(); // Enlève les codecs (audio/ogg; codecs=opus)
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();

  // Accepter si le type MIME est valide
  if (ACCEPTED_AUDIO_TYPES.includes(mimeType)) {
    return true;
  }

  // Accepter si l'extension est valide (même si le type MIME est générique)
  if (ACCEPTED_AUDIO_EXTENSIONS.includes(extension)) {
    return true;
  }

  // Accepter les types génériques si l'extension est audio
  if (
    (mimeType === 'application/octet-stream' || mimeType === '') &&
    ACCEPTED_AUDIO_EXTENSIONS.includes(extension)
  ) {
    return true;
  }

  return false;
}

// GET - Liste des audios d'un CV
export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const cv = await prisma.cV.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    const audioNotes = await prisma.audioNote.findMany({
      where: { cvId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    // Générer des URLs signées pour chaque audio
    const audioNotesWithUrls = await Promise.all(
      audioNotes.map(async (audio) => {
        let signedUrl: string | null = null;
        try {
          signedUrl = await getSignedDownloadUrl(audio.audioKey, 3600);
        } catch (e) {
          console.error(`Failed to get signed URL for ${audio.audioKey}:`, e);
        }
        return {
          ...audio,
          signedUrl,
        };
      })
    );

    return success(audioNotesWithUrls);
  });

// POST - Upload d'un nouvel audio
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Vérifier que le CV existe
    const cv = await prisma.cV.findUnique({
      where: { id },
      select: { id: true, consultantName: true, originalName: true },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    // Parse le formData
    const formData = await request.formData();
    const file = formData.get('audio') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Valider le type MIME ou l'extension
    if (!isValidAudioFile(file)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid audio file: ${file.name} (type: ${file.type}). Accepted extensions: ${ACCEPTED_AUDIO_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Valider la taille
    if (file.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size: ${MAX_AUDIO_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Déterminer le type MIME correct (le navigateur peut envoyer un type générique)
    let mimeType = file.type;
    const extension = file.name.split('.').pop()?.toLowerCase();

    // Corriger le type MIME pour les fichiers avec type générique
    if (!mimeType || mimeType === 'application/octet-stream') {
      const mimeMap: Record<string, string> = {
        'opus': 'audio/opus',
        'ogg': 'audio/ogg',
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4',
        'wav': 'audio/wav',
        'webm': 'audio/webm',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
      };
      mimeType = mimeMap[extension || ''] || 'audio/octet-stream';
    }

    // Déterminer le nom du consultant pour le dossier
    const consultantName = cv.consultantName || cv.originalName.replace(/\.[^/.]+$/, '');

    // Upload vers B2
    const { key, url } = await uploadAudio(
      consultantName,
      file.name,
      buffer,
      mimeType
    );

    // Créer l'entrée en base de données
    const audioNote = await prisma.audioNote.create({
      data: {
        cvId: id,
        originalName: file.name,
        audioKey: key,
        audioUrl: url,
        mimeType: mimeType, // Type MIME corrigé
        fileSize: file.size,
        status: 'PENDING', // En attente de transcription
      },
    });

    // Ajouter le job de transcription à la queue
    try {
      const queue = getAudioTranscriptionQueue();
      await queue.add(
        `transcribe-${audioNote.id}`,
        {
          audioNoteId: audioNote.id,
          cvId: id,
        },
        {
          jobId: `audio-${audioNote.id}`,
        }
      );
      console.log(`[Audio Upload] Transcription job queued for ${audioNote.id}`);
    } catch (queueError) {
      console.error('[Audio Upload] Failed to queue transcription job:', queueError);
      // Don't fail the upload if queue fails - transcription can be retried later
    }

    // Générer une URL signée pour l'accès immédiat
    const signedUrl = await getSignedDownloadUrl(key, 3600);

    return NextResponse.json({
      success: true,
      data: {
        ...audioNote,
        signedUrl,
      },
    });
  } catch (err) {
    console.error('Error uploading audio:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload audio',
      },
      { status: 500 }
    );
  }
}
