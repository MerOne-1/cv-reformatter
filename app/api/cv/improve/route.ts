import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { askLLM } from '@/lib/llm';
import { getAgentPrompts, AgentNotFoundError, AgentInactiveError } from '@/lib/agents';
import { detectMissingFields } from '@/lib/types';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

const improveSchema = z.object({
  cvId: z.string(),
  agentType: z.enum(['enrichisseur', 'adaptateur', 'contexte', 'bio']),
  additionalContext: z.string().optional(),
});

export const POST = apiRoute()
  .body(improveSchema)
  .handler(async (_, { body }) => {
    const { cvId, agentType, additionalContext } = body;

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    if (!cv.markdownContent) {
      return error('CV has no content to improve', 400);
    }

    let system: string;
    let user: string;
    try {
      const prompts = await getAgentPrompts(
        agentType,
        cv.markdownContent,
        additionalContext
      );
      system = prompts.system;
      user = prompts.user;
    } catch (e) {
      if (e instanceof AgentNotFoundError || e instanceof AgentInactiveError) {
        return error(e.message, 503);
      }
      throw e;
    }

    const improvedContent = await askLLM(system, user);

    const missingFields = detectMissingFields(improvedContent);

    await prisma.improvement.create({
      data: {
        cvId,
        agentType,
        prompt: additionalContext || '',
        result: improvedContent,
      },
    });

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
  });
