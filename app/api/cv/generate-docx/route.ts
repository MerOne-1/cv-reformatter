import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  generateDocxWithTemplate,
  getOutputFilenameFromTemplate,
} from '@/lib/docx-generator';
import { getTemplateById, getTemplateByName } from '@/lib/templates/template-utils';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

const generateSchema = z.object({
  cvId: z.string(),
  templateName: z.string().optional(),
  templateId: z.string().optional(),
});

export const POST = apiRoute()
  .body(generateSchema)
  .handler(async (_, { body }) => {
    const { cvId, templateName: requestedTemplateName, templateId } = body;

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    if (!cv.markdownContent) {
      return error('CV has no content to generate', 400);
    }

    let docxBuffer: Buffer;
    let filename: string;
    let templateNameToUse = requestedTemplateName || cv.templateName;

    if (templateId) {
      const template = await getTemplateById(templateId);
      if (!template) {
        return error('Template not found', 404);
      }

      docxBuffer = await generateDocxWithTemplate(cv.markdownContent, template);
      filename = getOutputFilenameFromTemplate(cv.consultantName || 'Consultant', template);
      templateNameToUse = template.name;
    } else {
      const template = await getTemplateByName(templateNameToUse);

      if (template) {
        docxBuffer = await generateDocxWithTemplate(cv.markdownContent, template);
        filename = getOutputFilenameFromTemplate(cv.consultantName || 'Consultant', template);
      } else {
        // Return error instead of silently falling back to legacy
        return error(`Template "${templateNameToUse}" not found`, 404);
      }
    }

    await prisma.cV.update({
      where: { id: cvId },
      data: {
        status: 'GENERATED',
        templateName: templateNameToUse,
        generatedAt: new Date(),
      },
    });

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });
