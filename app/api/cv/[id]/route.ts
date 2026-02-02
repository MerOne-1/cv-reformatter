import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detectMissingFields } from '@/lib/types';
import { deleteFile } from '@/lib/b2';
import { z } from 'zod';

const updateSchema = z.object({
  markdownContent: z.string().optional(),
  templateName: z.string().optional(),
  status: z
    .enum(['PENDING', 'EXTRACTED', 'EDITING', 'IMPROVED', 'GENERATED', 'COMPLETED'])
    .optional(),
  consultantName: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cv = await prisma.cV.findUnique({
      where: { id },
      include: {
        improvements: {
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cv,
    });
  } catch (error) {
    console.error('Error fetching CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch CV',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSchema.parse(body);

    // If markdown content is being updated, detect missing fields
    let missingFields: string[] | undefined;
    if (validatedData.markdownContent) {
      missingFields = detectMissingFields(validatedData.markdownContent);
    }

    const cv = await prisma.cV.update({
      where: { id },
      data: {
        ...validatedData,
        ...(missingFields !== undefined && { missingFields }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: cv,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update CV',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Récupérer le CV pour obtenir les clés B2
    const cv = await prisma.cV.findUnique({
      where: { id },
      select: {
        originalKey: true,
        generatedKey: true,
      },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    // Supprimer les fichiers de Backblaze B2
    const deleteResults = await Promise.allSettled([
      cv.originalKey ? deleteFile(cv.originalKey) : Promise.resolve(),
      cv.generatedKey ? deleteFile(cv.generatedKey) : Promise.resolve(),
    ]);

    // Logger les erreurs de suppression B2 mais continuer avec la suppression DB
    const failedDeletions: string[] = [];
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const key = index === 0 ? cv.originalKey : cv.generatedKey;
        console.error(`Échec de suppression du fichier B2 ${key}:`, result.reason);
        failedDeletions.push(key || 'unknown');
      }
    });

    // Supprimer le CV de la base de données
    await prisma.cV.delete({
      where: { id },
    });

    // Inclure un avertissement si certains fichiers B2 n'ont pas pu être supprimés
    if (failedDeletions.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'CV deleted from database, but some files could not be deleted from storage',
        warnings: failedDeletions.map(key => `Failed to delete: ${key}`),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'CV deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete CV',
      },
      { status: 500 }
    );
  }
}
