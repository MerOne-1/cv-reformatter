import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { TemplateConfigSchema, toTemplateWithParsedConfig } from '@/lib/templates/types';
import { deleteTemplateLogo } from '@/lib/templates/template-utils';

// GET single template with parsed config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toTemplateWithParsedConfig(template),
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

const updateTemplateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  mutedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().nullable().optional(),
  logoHeaderUrl: z.string().url().nullable().optional(),
  logoFooterUrl: z.string().url().nullable().optional(),
  website: z.string().nullable().optional(),
  config: TemplateConfigSchema.optional(),
  isActive: z.boolean().optional(),
});

// PATCH update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    // Copy simple fields
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;
    if (data.textColor !== undefined) updateData.textColor = data.textColor;
    if (data.mutedColor !== undefined) updateData.mutedColor = data.mutedColor;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.logoHeaderUrl !== undefined) updateData.logoHeaderUrl = data.logoHeaderUrl;
    if (data.logoFooterUrl !== undefined) updateData.logoFooterUrl = data.logoFooterUrl;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Stringify config if provided
    if (data.config !== undefined) {
      updateData.config = JSON.stringify(data.config);
    }

    const template = await prisma.template.update({
      where: { id },
      data: updateData,
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
    console.error('Error updating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE template (also deletes logos from B2)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get template to delete logos
    const template = await prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Delete logos from B2 (don't fail if this errors)
    await Promise.allSettled([
      template.logoHeaderUrl ? deleteTemplateLogo(template.logoHeaderUrl) : Promise.resolve(),
      template.logoFooterUrl ? deleteTemplateLogo(template.logoFooterUrl) : Promise.resolve(),
    ]);

    // Delete from database
    await prisma.template.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
