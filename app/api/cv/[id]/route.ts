import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detectMissingFields } from '@/lib/types';
import { deleteFile } from '@/lib/b2';
import { z } from 'zod';

const updateSchema = z.object({
  markdownContent: z.string().optional(),
  brand: z.enum(['DREAMIT', 'RUPTURAE']).optional(),
  status: z
    .enum(['PENDING', 'EXTRACTED', 'EDITING', 'IMPROVED', 'GENERATED', 'COMPLETED'])
    .optional(),
  consultantName: z.string().optional(),
  title: z.string().optional(),
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
    const deletePromises: Promise<void>[] = [];

    // Supprimer le fichier original
    if (cv.originalKey) {
      deletePromises.push(
        deleteFile(cv.originalKey).catch((err) => {
          console.error(`Failed to delete original file ${cv.originalKey}:`, err);
        })
      );
    }

    // Supprimer le fichier généré s'il existe
    if (cv.generatedKey) {
      deletePromises.push(
        deleteFile(cv.generatedKey).catch((err) => {
          console.error(`Failed to delete generated file ${cv.generatedKey}:`, err);
        })
      );
    }

    // Attendre que tous les fichiers soient supprimés
    await Promise.all(deletePromises);

    // Supprimer le CV de la base de données
    await prisma.cV.delete({
      where: { id },
    });

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
