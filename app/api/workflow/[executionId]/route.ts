import prisma from '@/lib/db';
import { getAgentExecutionQueue, getWorkflowOrchestrationQueue } from '@/lib/queue';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';

const paramsSchema = z.object({ executionId: z.string() });

export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: params.executionId },
      include: {
        cv: {
          select: {
            id: true,
            originalName: true,
            consultantName: true,
            status: true,
          },
        },
        steps: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!execution) {
      return error('Exécution introuvable', 404);
    }

    const summary = {
      total: execution.steps.length,
      pending: execution.steps.filter((s) => s.status === 'PENDING').length,
      waitingInputs: execution.steps.filter((s) => s.status === 'WAITING_INPUTS').length,
      running: execution.steps.filter((s) => s.status === 'RUNNING').length,
      completed: execution.steps.filter((s) => s.status === 'COMPLETED').length,
      failed: execution.steps.filter((s) => s.status === 'FAILED').length,
      skipped: execution.steps.filter((s) => s.status === 'SKIPPED').length,
    };

    return success({ ...execution, summary });
  });

export const DELETE = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: params.executionId },
      include: {
        steps: {
          select: { jobId: true },
        },
      },
    });

    if (!execution) {
      return error('Exécution introuvable', 404);
    }

    if (execution.status === 'COMPLETED' || execution.status === 'FAILED') {
      return error('Cette exécution est déjà terminée', 400);
    }

    const agentQueue = getAgentExecutionQueue();
    const orchestratorQueue = getWorkflowOrchestrationQueue();

    const jobsToRemove = execution.steps
      .filter((s) => s.jobId)
      .map((s) => s.jobId!);

    const failedJobRemovals: string[] = [];

    for (const jobId of jobsToRemove) {
      try {
        const job = await agentQueue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch (e) {
        console.error(`Failed to remove job ${jobId}:`, e);
        failedJobRemovals.push(jobId);
      }
    }

    try {
      const orchestratorJob = await orchestratorQueue.getJob(`workflow-${params.executionId}`);
      if (orchestratorJob) {
        await orchestratorJob.remove();
      }
    } catch (e) {
      console.error(`Failed to remove orchestrator job for ${params.executionId}:`, e);
      failedJobRemovals.push(`orchestrator-${params.executionId}`);
    }

    await prisma.workflowExecution.update({
      where: { id: params.executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: 'Annulé par l\'utilisateur',
      },
    });

    await prisma.workflowStep.updateMany({
      where: {
        executionId: params.executionId,
        status: { in: ['PENDING', 'WAITING_INPUTS', 'RUNNING'] },
      },
      data: {
        status: 'SKIPPED',
        completedAt: new Date(),
      },
    });

    if (failedJobRemovals.length > 0) {
      return success({
        cancelled: true,
        warnings: failedJobRemovals.map(id => `Failed to remove job: ${id}`),
      });
    }

    return success({ cancelled: true });
  });
