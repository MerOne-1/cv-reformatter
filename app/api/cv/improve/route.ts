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
});

export const POST = apiRoute()
  .body(improveSchema)
  .handler(async (_, { body }) => {
    const { cvId, agentType } = body;

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
      select: {
        id: true,
        markdownContent: true,
        notes: true,
        futureMissionNotes: true,
      },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    if (!cv.markdownContent) {
      return error('CV has no content to improve', 400);
    }

    // Récupérer l'agent pour avoir son ID
    const agent = await prisma.aIAgent.findUnique({
      where: { name: agentType },
      select: { id: true },
    });

    if (!agent) {
      return error(`Agent "${agentType}" non trouvé`, 503);
    }

    let system: string;
    let user: string;
    try {
      const prompts = await getAgentPrompts(agentType, {
        markdown: cv.markdownContent,
        pastMissionNotes: cv.notes || undefined,
        futureMissionNotes: cv.futureMissionNotes || undefined,
      });
      system = prompts.system;
      user = prompts.user;
    } catch (e) {
      if (e instanceof AgentNotFoundError || e instanceof AgentInactiveError) {
        return error(e.message, 503);
      }
      throw e;
    }

    // Mesurer la durée de l'appel LLM
    const startTime = Date.now();
    const improvedContent = await askLLM(system, user);
    const durationMs = Date.now() - startTime;

    const missingFields = detectMissingFields(improvedContent);

    // Créer le log détaillé de l'exécution
    await prisma.agentExecutionLog.create({
      data: {
        agentId: agent.id,
        cvId,
        systemPrompt: system,
        userPrompt: user,
        inputMarkdown: cv.markdownContent,
        pastMissionNotes: cv.notes || null,
        futureMissionNotes: cv.futureMissionNotes || null,
        outputMarkdown: improvedContent,
        durationMs,
        success: true,
      },
    });

    await prisma.improvement.create({
      data: {
        cvId,
        agentType,
        prompt: user.substring(0, 1000),
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
