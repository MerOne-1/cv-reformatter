import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { TemplateConfigSchema, toTemplateWithParsedConfig } from '@/lib/templates/types';
import { deleteTemplateLogo } from '@/lib/templates/template-utils';
import { apiRoute, success, error } from '@/lib/api-route';

const paramsSchema = z.object({ id: z.string() });

const updateTemplateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  mutedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().nullable().optional(),
  logoHeaderUrl: z.string().url().nullable().optional(),
  logoFooterUrl: z.string().url().nullable().optional(),
  website: z.string().nullable().optional(),
  config: TemplateConfigSchema.optional(),
  isActive: z.boolean().optional(),
});

export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const template = await prisma.template.findUnique({
      where: { id: params.id },
    });

    if (!template) {
      return error('Template not found', 404);
    }

    return NextResponse.json({
      success: true,
      data: toTemplateWithParsedConfig(template),
    });
  });

export const PATCH = apiRoute()
  .params(paramsSchema)
  .body(updateTemplateSchema)
  .handler(async (_, { params, body }) => {
    const updateData: Record<string, unknown> = {};

    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
    if (body.secondaryColor !== undefined) updateData.secondaryColor = body.secondaryColor;
    if (body.textColor !== undefined) updateData.textColor = body.textColor;
    if (body.mutedColor !== undefined) updateData.mutedColor = body.mutedColor;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.logoHeaderUrl !== undefined) updateData.logoHeaderUrl = body.logoHeaderUrl;
    if (body.logoFooterUrl !== undefined) updateData.logoFooterUrl = body.logoFooterUrl;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    if (body.config !== undefined) {
      updateData.config = JSON.stringify(body.config);
    }

    const template = await prisma.template.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: toTemplateWithParsedConfig(template),
    });
  });

export const DELETE = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const template = await prisma.template.findUnique({
      where: { id: params.id },
    });

    if (!template) {
      return error('Template not found', 404);
    }

    // Delete logos from storage
    const deleteResults = await Promise.allSettled([
      template.logoHeaderUrl ? deleteTemplateLogo(template.logoHeaderUrl) : Promise.resolve(),
      template.logoFooterUrl ? deleteTemplateLogo(template.logoFooterUrl) : Promise.resolve(),
    ]);

    // Track failed deletions
    const warnings: string[] = [];
    const logoTypes = ['header', 'footer'];
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const logoUrl = index === 0 ? template.logoHeaderUrl : template.logoFooterUrl;
        if (logoUrl) {
          console.error(`Failed to delete ${logoTypes[index]} logo:`, result.reason);
          warnings.push(`Le logo ${logoTypes[index]} n'a pas pu être supprimé du stockage`);
        }
      }
    });

    await prisma.template.delete({
      where: { id: params.id },
    });

    if (warnings.length > 0) {
      return success({ message: 'Template deleted', warnings });
    }

    return success({ message: 'Template deleted' });
  });
