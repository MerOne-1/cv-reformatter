import prisma from '@/lib/db';
import { deleteFile, getSignedDownloadUrl } from '@/lib/b2';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';
import { NextResponse } from 'next/server';

const paramsSchema = z.object({
  id: z.string(),
  audioId: z.string(),
});

// GET - Détails d'un audio avec URL signée
export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const audioNote = await prisma.audioNote.findFirst({
      where: {
        id: params.audioId,
        cvId: params.id,
      },
    });

    if (!audioNote) {
      return error('Audio not found', 404);
    }

    // Générer une URL signée
    let signedUrl: string | null = null;
    try {
      signedUrl = await getSignedDownloadUrl(audioNote.audioKey, 3600);
    } catch (e) {
      console.error(`Failed to get signed URL for ${audioNote.audioKey}:`, e);
    }

    return success({
      ...audioNote,
      signedUrl,
    });
  });

// DELETE - Supprimer un audio
export const DELETE = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    // Utiliser une transaction pour garantir l'atomicité
    const result = await prisma.$transaction(async (tx) => {
      const audioNote = await tx.audioNote.findFirst({
        where: {
          id: params.audioId,
          cvId: params.id,
        },
        select: {
          id: true,
          audioKey: true,
        },
      });

      if (!audioNote) {
        return { notFound: true } as const;
      }

      // Supprimer de la base de données
      await tx.audioNote.delete({
        where: { id: params.audioId },
      });

      return { audioNote } as const;
    });

    if ('notFound' in result) {
      return error('Audio not found', 404);
    }

    // Supprimer le fichier de B2 après la transaction DB
    try {
      await deleteFile(result.audioNote.audioKey);
    } catch (deleteError) {
      console.error(
        `Failed to delete audio file from B2: ${result.audioNote.audioKey}`,
        deleteError
      );
      // On retourne quand même success car l'entrée DB a été supprimée
      return NextResponse.json({
        success: true,
        message: 'Audio deleted from database, but file could not be deleted from storage',
        warning: `Failed to delete: ${result.audioNote.audioKey}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Audio deleted successfully',
    });
  });
