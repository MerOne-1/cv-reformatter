import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection';
import { QUEUE_NAMES } from '../queues';
import prisma from '@/lib/db';
import { downloadFile } from '@/lib/b2';
import { getSonioxClient } from '@/lib/soniox';

export interface AudioTranscriptionJobData {
  audioNoteId: string;
  cvId: string;
}

export interface AudioTranscriptionJobResult {
  audioNoteId: string;
  success: boolean;
  transcription?: string;
  language?: string;
  duration?: number;
  error?: string;
}

let audioTranscriptionWorker: Worker | null = null;

export async function processAudioTranscriptionJob(
  job: Job<AudioTranscriptionJobData>
): Promise<AudioTranscriptionJobResult> {
  const { audioNoteId, cvId } = job.data;

  console.log(`[Audio Transcription Worker] Processing job ${job.id} for audio ${audioNoteId}`);

  // Update status to UPLOADING
  await prisma.audioNote.update({
    where: { id: audioNoteId },
    data: { status: 'UPLOADING' },
  });

  try {
    // Get audio note details
    const audioNote = await prisma.audioNote.findUnique({
      where: { id: audioNoteId },
    });

    if (!audioNote) {
      throw new Error(`AudioNote ${audioNoteId} not found`);
    }

    // Download audio from B2
    console.log(`[Audio Transcription Worker] Downloading audio from B2: ${audioNote.audioKey}`);
    const audioBuffer = await downloadFile(audioNote.audioKey);

    // Update status to PROCESSING
    await prisma.audioNote.update({
      where: { id: audioNoteId },
      data: { status: 'PROCESSING' },
    });

    // Transcribe with Soniox
    console.log(`[Audio Transcription Worker] Starting Soniox transcription for ${audioNote.originalName}`);
    const soniox = getSonioxClient();

    const result = await soniox.transcribe(audioBuffer, audioNote.originalName, {
      languageHints: ['fr', 'en', 'ar'], // Common languages for CVs
      enableSpeakerDiarization: false, // Usually single speaker for voice notes
      pollIntervalMs: 2000,
      maxWaitMs: 300000, // 5 minutes max
      onProgress: (status) => {
        console.log(`[Audio Transcription Worker] Soniox status: ${status}`);
      },
    });

    console.log(`[Audio Transcription Worker] Transcription completed. Language: ${result.language}, Duration: ${result.duration}s`);

    // Update audio note with transcription
    await prisma.audioNote.update({
      where: { id: audioNoteId },
      data: {
        status: 'COMPLETED',
        transcription: result.text,
        language: result.language,
        duration: result.duration,
        transcribedAt: new Date(),
      },
    });

    return {
      audioNoteId,
      success: true,
      transcription: result.text,
      language: result.language,
      duration: result.duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Audio Transcription Worker] Error processing ${audioNoteId}:`, errorMessage);

    // Update audio note with error
    await prisma.audioNote.update({
      where: { id: audioNoteId },
      data: {
        status: 'FAILED',
        errorMessage: errorMessage,
      },
    });

    return {
      audioNoteId,
      success: false,
      error: errorMessage,
    };
  }
}

export function startAudioTranscriptionWorker(): Worker {
  if (audioTranscriptionWorker) {
    return audioTranscriptionWorker;
  }

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

  audioTranscriptionWorker = new Worker<AudioTranscriptionJobData, AudioTranscriptionJobResult>(
    QUEUE_NAMES.AUDIO_TRANSCRIPTION,
    processAudioTranscriptionJob,
    {
      connection: getRedisConnection(),
      concurrency,
    }
  );

  audioTranscriptionWorker.on('completed', (job, result) => {
    if (result.success) {
      console.log(`[Audio Transcription Worker] Job ${job.id} completed successfully`);
    } else {
      console.log(`[Audio Transcription Worker] Job ${job.id} failed: ${result.error}`);
    }
  });

  audioTranscriptionWorker.on('failed', (job, error) => {
    console.error(`[Audio Transcription Worker] Job ${job?.id} failed with error:`, error.message);
  });

  audioTranscriptionWorker.on('error', (error) => {
    console.error('[Audio Transcription Worker] Worker error:', error);
  });

  console.log(`[Audio Transcription Worker] Started with concurrency ${concurrency}`);

  return audioTranscriptionWorker;
}

export async function stopAudioTranscriptionWorker(): Promise<void> {
  if (audioTranscriptionWorker) {
    await audioTranscriptionWorker.close();
    audioTranscriptionWorker = null;
    console.log('[Audio Transcription Worker] Stopped');
  }
}

export { audioTranscriptionWorker };
