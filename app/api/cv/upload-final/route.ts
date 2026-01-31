import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateDocx, generateDocxWithTemplate, getOutputFilename, getOutputFilenameFromTemplate } from '@/lib/docx-generator';
import { uploadFinalCV } from '@/lib/b2';
import { getTemplateByName } from '@/lib/templates/template-utils';
import { z } from 'zod';

const uploadSchema = z.object({
  cvId: z.string(),
  templateName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, templateName: requestedTemplateName } = uploadSchema.parse(body);

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

    const templateNameToUse = requestedTemplateName || cv.templateName;

    // Try to get template from database
    const template = await getTemplateByName(templateNameToUse);

    let docxBuffer: Buffer;
    let filename: string;

    if (template) {
      // Use template-based generator
      docxBuffer = await generateDocxWithTemplate(cv.markdownContent, template);
      filename = getOutputFilenameFromTemplate(cv.consultantName || 'Consultant', template);
    } else {
      // Fallback to legacy generator
      console.warn(`Template "${templateNameToUse}" not found in database, falling back to legacy generator`);
      const legacyBrand = (templateNameToUse === 'RUPTURAE' ? 'RUPTURAE' : 'DREAMIT') as 'DREAMIT' | 'RUPTURAE';
      docxBuffer = await generateDocx(cv.markdownContent, legacyBrand);
      filename = getOutputFilename(cv.consultantName || 'Consultant', legacyBrand);
    }

    // Upload to B2
    const { key, url } = await uploadFinalCV(filename, docxBuffer);

    // Update CV with final file info
    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        status: 'COMPLETED',
        templateName: templateNameToUse,
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
