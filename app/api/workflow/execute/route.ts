import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { getWorkflowOrchestrationQueue } from '@/lib/queue';
import { apiRoute, error } from '@/lib/api-route';

const executeSchema = z.object({
  cvId: z.string().min(1),
  additionalContext: z.string().optional(),
});

export const POST = apiRoute()
  .body(executeSchema)
  .handler(async (_, { body }) => {
    const cv = await prisma.cV.findUnique({
      where: { id: body.cvId },
      select: { id: true, markdownContent: true, status: true },
    });

    if (!cv) {
      return error('CV introuvable', 404);
    }

    if (!cv.markdownContent) {
      return error('Le CV doit être extrait avant de lancer un workflow', 400);
    }

    const activeAgents = await prisma.aIAgent.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (activeAgents.length === 0) {
      return error('Aucun agent actif configuré', 400);
    }

    const execution = await prisma.workflowExecution.create({
      data: {
        cvId: body.cvId,
        status: 'PENDING',
        inputData: body.additionalContext
          ? JSON.stringify({ additionalContext: body.additionalContext })
          : null,
      },
    });

    const queue = getWorkflowOrchestrationQueue();
    await queue.add(
      'orchestrate-workflow',
      {
        executionId: execution.id,
        cvId: body.cvId,
        additionalContext: body.additionalContext,
      },
      {
        jobId: `workflow-${execution.id}`,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        executionId: execution.id,
        status: execution.status,
        message: 'Workflow lancé avec succès',
      },
    });
  });
