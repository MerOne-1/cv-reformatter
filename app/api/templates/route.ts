import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { TemplateConfigSchema, toTemplateWithParsedConfig } from '@/lib/templates/types';
import { apiRoute, success, error } from '@/lib/api-route';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  mutedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
  logoHeaderUrl: z.string().url().optional(),
  logoFooterUrl: z.string().url().optional(),
  website: z.string().optional(),
  config: TemplateConfigSchema.optional(),
});

export const GET = apiRoute().handler(async () => {
  const templates = await prisma.template.findMany({
    orderBy: { name: 'asc' },
  });

  const templatesWithParsedConfig = templates.map(toTemplateWithParsedConfig);

  return success(templatesWithParsedConfig);
});

export const POST = apiRoute()
  .body(createTemplateSchema)
  .handler(async (_, { body }) => {
    try {
      const template = await prisma.template.create({
        data: {
          name: body.name.toUpperCase(),
          displayName: body.displayName,
          primaryColor: body.primaryColor,
          secondaryColor: body.secondaryColor,
          textColor: body.textColor || '#1F2937',
          mutedColor: body.mutedColor || '#6B7280',
          logoUrl: body.logoUrl,
          logoHeaderUrl: body.logoHeaderUrl,
          logoFooterUrl: body.logoFooterUrl,
          website: body.website,
          config: JSON.stringify(body.config || {}),
        },
      });

      return NextResponse.json({
        success: true,
        data: toTemplateWithParsedConfig(template),
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return error('Un template avec ce nom existe déjà', 409);
      }
      throw e;
    }
  });
