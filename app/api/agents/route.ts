import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export async function GET() {
  try {
    const agents = await prisma.aIAgent.findMany({
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

const createAgentSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  order: z.number().int().optional().default(0),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createAgentSchema.parse(body);

    const agent = await prisma.aIAgent.create({
      data,
    });

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'An agent with this name already exists' },
        { status: 409 }
      );
    }
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
