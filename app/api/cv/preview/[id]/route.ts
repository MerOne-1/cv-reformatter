import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { downloadFile } from '@/lib/b2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cv = await prisma.cV.findUnique({
      where: { id },
      select: { originalKey: true, originalName: true },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    // Download file from B2
    const fileBuffer = await downloadFile(cv.originalKey);

    // Determine content type
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
  } catch (error) {
    console.error('Error fetching CV preview:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch CV',
      },
      { status: 500 }
    );
  }
}
