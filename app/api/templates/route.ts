import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { TemplateConfigSchema, toTemplateWithParsedConfig } from '@/lib/templates/types';

// GET all templates with parsed config
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { name: 'asc' },
    });

    // Parse config for each template
    const templatesWithParsedConfig = templates.map(toTemplateWithParsedConfig);

    return NextResponse.json({
      success: true,
      data: templatesWithParsedConfig,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

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

// POST create template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const template = await prisma.template.create({
      data: {
        name: data.name.toUpperCase(),
        displayName: data.displayName,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        textColor: data.textColor || '#1F2937',
        mutedColor: data.mutedColor || '#6B7280',
        logoUrl: data.logoUrl,
        logoHeaderUrl: data.logoHeaderUrl,
        logoFooterUrl: data.logoFooterUrl,
        website: data.website,
        config: JSON.stringify(data.config || {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: toTemplateWithParsedConfig(template),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
