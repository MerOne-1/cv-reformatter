import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { askLLM } from '@/lib/llm';
import { getAgentPrompts } from '@/lib/agents';
import { detectMissingFields } from '@/lib/types';
import { z } from 'zod';

const improveSchema = z.object({
  cvId: z.string(),
  agentType: z.enum(['enrichisseur', 'adaptateur', 'contexte', 'bio']),
  additionalContext: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, agentType, additionalContext } = improveSchema.parse(body);

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
        { success: false, error: 'CV has no content to improve' },
        { status: 400 }
      );
    }

    // Get prompts for the agent type (from DB or fallback to static)
    const { system, user } = await getAgentPrompts(
      agentType,
      cv.markdownContent,
      additionalContext
    );

    // Call LLM
    const improvedContent = await askLLM(system, user);

    // Detect missing fields in improved content
    const missingFields = detectMissingFields(improvedContent);

    // Save the improvement
    await prisma.improvement.create({
      data: {
        cvId,
        agentType,
        prompt: additionalContext || '',
        result: improvedContent,
      },
    });

    // Update CV with improved content
    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        markdownContent: improvedContent,
        missingFields,
        status: 'IMPROVED',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedCV.id,
        markdownContent: updatedCV.markdownContent,
        missingFields: updatedCV.missingFields,
        agentType,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error improving CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to improve CV',
      },
      { status: 500 }
    );
  }
}
