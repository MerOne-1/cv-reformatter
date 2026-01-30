import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateDocx, getOutputFilename } from '@/lib/docx-generator';
import { z } from 'zod';

const generateSchema = z.object({
  cvId: z.string(),
  brand: z.enum(['DREAMIT', 'RUPTURAE']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, brand: requestedBrand } = generateSchema.parse(body);

    // Get CV from database
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    if (!cv.markdownContent) {
      return NextResponse.json(
        { success: false, error: 'CV has no content to generate' },
        { status: 400 }
      );
    }

    const brand = requestedBrand || cv.brand;

    // Generate DOCX
    const docxBuffer = await generateDocx(cv.markdownContent, brand);

    // Generate filename
    const filename = getOutputFilename(
      cv.consultantName || 'Consultant',
      brand
    );

    // Update CV status
    await prisma.cV.update({
      where: { id: cvId },
      data: {
        status: 'GENERATED',
        brand,
        generatedAt: new Date(),
      },
    });

    // Return the DOCX as a download
    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate DOCX',
      },
      { status: 500 }
    );
  }
}
