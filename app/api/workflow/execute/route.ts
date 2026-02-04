import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { getWorkflowOrchestrationQueue } from '@/lib/queue';
import { apiRoute, error } from '@/lib/api-route';

const executeSchema = z.object({
  cvId: z.string().min(1),
  mode: z.enum(['full', 'fast']).optional().default('full'),
});

// Timeout en minutes pour les workflows bloqués
const WORKFLOW_TIMEOUT_MINUTES = 5;

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

    // Nettoyer automatiquement les workflows bloqués (timeout)
    const timeoutThreshold = new Date(Date.now() - WORKFLOW_TIMEOUT_MINUTES * 60 * 1000);
    await prisma.workflowExecution.updateMany({
      where: {
        cvId: body.cvId,
        status: { in: ['PENDING', 'RUNNING'] },
        startedAt: { lt: timeoutThreshold },
      },
      data: {
        status: 'FAILED',
        error: `Timeout: workflow bloqué depuis plus de ${WORKFLOW_TIMEOUT_MINUTES} minutes`,
        completedAt: new Date(),
      },
    });

    // Vérifier qu'il n'y a pas d'exécution en cours pour ce CV
    const existingExecution = await prisma.workflowExecution.findFirst({
      where: {
        cvId: body.cvId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      select: { id: true, status: true },
    });

    if (existingExecution) {
      return error(
        `Un workflow est déjà en cours pour ce CV (ID: ${existingExecution.id}, status: ${existingExecution.status})`,
        409
      );
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
      },
    });

    try {
      const queue = getWorkflowOrchestrationQueue();
      await queue.add(
        'orchestrate-workflow',
        {
          executionId: execution.id,
          cvId: body.cvId,
          mode: body.mode,
        },
        {
          jobId: `workflow-${execution.id}`,
        }
      );
    } catch (queueError) {
      // Échec de connexion Redis - marquer le workflow comme FAILED
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: `Échec de connexion à la queue Redis: ${queueError instanceof Error ? queueError.message : 'Erreur inconnue'}`,
          completedAt: new Date(),
        },
      });
      console.error('[Workflow Execute] Redis queue error:', queueError);
      return error('Erreur de connexion au serveur de tâches. Veuillez réessayer.', 503);
    }

    return NextResponse.json({
      success: true,
      data: {
        executionId: execution.id,
        status: execution.status,
        message: 'Workflow lancé avec succès',
      },
    });
  });
