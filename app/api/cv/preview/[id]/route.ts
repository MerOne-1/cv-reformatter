import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { downloadFile } from '@/lib/b2';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

const paramsSchema = z.object({ id: z.string() });

export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const cv = await prisma.cV.findUnique({
      where: { id: params.id },
      select: { originalKey: true, originalName: true },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    const fileBuffer = await downloadFile(cv.originalKey);

    const ext = cv.originalName.split('.').pop()?.toLowerCase();
    const contentType = ext === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${cv.originalName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  });
