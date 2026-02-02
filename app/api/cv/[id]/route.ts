import prisma from '@/lib/db';
import { detectMissingFields } from '@/lib/types';
import { deleteFile } from '@/lib/b2';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';
import { NextResponse } from 'next/server';

const paramsSchema = z.object({ id: z.string() });

const updateSchema = z.object({
  markdownContent: z.string().optional(),
  templateName: z.string().optional(),
  status: z
    .enum(['PENDING', 'EXTRACTED', 'EDITING', 'IMPROVED', 'GENERATED', 'COMPLETED'])
    .optional(),
  consultantName: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const cv = await prisma.cV.findUnique({
      where: { id: params.id },
      include: {
        improvements: {
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    return success(cv);
  });

export const PATCH = apiRoute()
  .params(paramsSchema)
  .body(updateSchema)
  .handler(async (_, { params, body }) => {
    let missingFields: string[] | undefined;
    if (body.markdownContent) {
      missingFields = detectMissingFields(body.markdownContent);
    }

    const cv = await prisma.cV.update({
      where: { id: params.id },
      data: {
        ...body,
        ...(missingFields !== undefined && { missingFields }),
        updatedAt: new Date(),
      },
    });

    return success(cv);
  });

export const DELETE = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    // Use transaction to ensure atomicity and prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const cv = await tx.cV.findUnique({
        where: { id: params.id },
        select: {
          originalKey: true,
          generatedKey: true,
        },
      });

      if (!cv) {
        return { notFound: true } as const;
      }

      // Delete from database first (inside transaction)
      await tx.cV.delete({
        where: { id: params.id },
      });

      return { cv } as const;
    });

    if ('notFound' in result) {
      return error('CV not found', 404);
    }

    // Delete files from B2 after successful DB transaction
    const { cv } = result;
    const deleteResults = await Promise.allSettled([
      cv.originalKey ? deleteFile(cv.originalKey) : Promise.resolve(),
      cv.generatedKey ? deleteFile(cv.generatedKey) : Promise.resolve(),
    ]);

    const failedDeletions: string[] = [];
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const key = index === 0 ? cv.originalKey : cv.generatedKey;
        console.error(`Échec de suppression du fichier B2 ${key}:`, result.reason);
        failedDeletions.push(key || 'unknown');
      }
    });

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
  });
