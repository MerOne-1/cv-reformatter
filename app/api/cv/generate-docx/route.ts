import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  generateDocx,
  generateDocxWithTemplate,
  getOutputFilename,
  getOutputFilenameFromTemplate,
} from '@/lib/docx-generator';
import { getTemplateById, getTemplateByName } from '@/lib/templates/template-utils';
import { z } from 'zod';

const generateSchema = z.object({
  cvId: z.string(),
  brand: z.enum(['DREAMIT', 'RUPTURAE']).optional(),
  templateId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, brand: requestedBrand, templateId } = generateSchema.parse(body);

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

    let docxBuffer: Buffer;
    let filename: string;
    let brand = requestedBrand || cv.brand;

    // Priority: templateId > brand > cv.brand
    if (templateId) {
      // Use specific template by ID
      const template = await getTemplateById(templateId);
      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template not found' },
          { status: 404 }
        );
      }

      docxBuffer = await generateDocxWithTemplate(cv.markdownContent, template);
      filename = getOutputFilenameFromTemplate(cv.consultantName || 'Consultant', template);

      // Update brand to match template name if it matches
      if (template.name === 'DREAMIT' || template.name === 'RUPTURAE') {
        brand = template.name as typeof brand;
      }
    } else {
      // Use brand-based template lookup (backward compatible)
      const template = await getTemplateByName(brand);

      if (template) {
        // Template found in database - use new generator
        docxBuffer = await generateDocxWithTemplate(cv.markdownContent, template);
        filename = getOutputFilenameFromTemplate(cv.consultantName || 'Consultant', template);
      } else {
        // Fallback to legacy generator with hardcoded colors
        docxBuffer = await generateDocx(cv.markdownContent, brand);
        filename = getOutputFilename(cv.consultantName || 'Consultant', brand);
      }
    }

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
