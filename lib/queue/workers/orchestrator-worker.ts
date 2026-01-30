import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection';
import { QUEUE_NAMES } from '../queues';
import { createAgentWorkflow } from '../flow-producer';
import prisma from '@/lib/db';
import type { WorkflowConfig } from '@/lib/types';

let orchestratorWorker: Worker | null = null;

interface OrchestratorJobData extends WorkflowConfig {
  executionId: string;
}

export async function processOrchestratorJob(
  job: Job<OrchestratorJobData>
): Promise<{ executionId: string; status: string }> {
  const { executionId, cvId, additionalContext } = job.data;

  console.log(`[Orchestrator] Starting workflow ${executionId} for CV ${cvId}`);

  try {
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
      select: { markdownContent: true },
    });

    if (!cv || !cv.markdownContent) {
      throw new Error('CV not found or has no content');
    }

    await createAgentWorkflow(
      executionId,
      cvId,
      cv.markdownContent,
      additionalContext
    );

    console.log(`[Orchestrator] Workflow ${executionId} jobs created`);

    return {
      executionId,
      status: 'JOBS_CREATED',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Orchestrator] Workflow ${executionId} failed:`, errorMessage);

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    throw error;
  }
}

export function startOrchestratorWorker(): Worker {
  if (orchestratorWorker) {
    return orchestratorWorker;
  }

  orchestratorWorker = new Worker(
    QUEUE_NAMES.WORKFLOW_ORCHESTRATION,
    processOrchestratorJob,
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );

  orchestratorWorker.on('completed', (job, result) => {
    console.log(`[Orchestrator] Job ${job.id} completed:`, result.status);
  });

  orchestratorWorker.on('failed', (job, error) => {
    console.error(`[Orchestrator] Job ${job?.id} failed:`, error.message);
  });

  orchestratorWorker.on('error', (error) => {
    console.error('[Orchestrator] Worker error:', error.message);
  });

  console.log('[Orchestrator] Worker started');
  return orchestratorWorker;
}

export async function stopOrchestratorWorker(): Promise<void> {
  if (orchestratorWorker) {
    await orchestratorWorker.close();
    orchestratorWorker = null;
    console.log('[Orchestrator] Worker stopped');
  }
}
