import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';

// GET all templates
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: templates,
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
  logoUrl: z.string().optional(),
  config: z.record(z.any()).optional(),
});

// POST create template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const template = await prisma.template.create({
      data: {
        ...data,
        config: JSON.stringify(data.config || {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
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
