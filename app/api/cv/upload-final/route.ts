import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateDocx, getOutputFilename } from '@/lib/docx-generator';
import { uploadFinalCV } from '@/lib/b2';
import { z } from 'zod';

const uploadSchema = z.object({
  cvId: z.string(),
  brand: z.enum(['DREAMIT', 'RUPTURAE']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, brand: requestedBrand } = uploadSchema.parse(body);

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

    // Upload to B2
    const { key, url } = await uploadFinalCV(filename, docxBuffer);

    // Update CV with final file info
    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        status: 'COMPLETED',
        brand,
        generatedKey: key,
        generatedUrl: url,
        generatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedCV.id,
        generatedKey: updatedCV.generatedKey,
        generatedUrl: updatedCV.generatedUrl,
        filename,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error uploading final CV:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to upload final CV',
      },
      { status: 500 }
    );
  }
}
