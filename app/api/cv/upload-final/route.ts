import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateDocxWithTemplate, getOutputFilenameFromTemplate } from '@/lib/docx-generator';
import { uploadFinalCV } from '@/lib/b2';
import { getTemplateByName } from '@/lib/templates/template-utils';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

const uploadSchema = z.object({
  cvId: z.string(),
  templateName: z.string().optional(),
});

export const POST = apiRoute()
  .body(uploadSchema)
  .handler(async (_, { body }) => {
    const { cvId, templateName: requestedTemplateName } = body;

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    if (!cv.markdownContent) {
      return error('CV has no content to generate', 400);
    }

    const templateNameToUse = requestedTemplateName || cv.templateName;

    const template = await getTemplateByName(templateNameToUse);

    let docxBuffer: Buffer;
    let filename: string;

    if (template) {
      docxBuffer = await generateDocxWithTemplate(cv.markdownContent, template);
      filename = getOutputFilenameFromTemplate(cv.consultantName || 'Consultant', template);
    } else {
      // Return error instead of silently falling back to legacy
      return error(`Template "${templateNameToUse}" not found`, 404);
    }

    const { key, url } = await uploadFinalCV(filename, docxBuffer);

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
  });
