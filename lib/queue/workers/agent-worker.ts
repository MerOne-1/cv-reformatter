import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection';
import { QUEUE_NAMES } from '../queues';
import prisma from '@/lib/db';
import { askMistral } from '@/lib/mistral';
import { getAgentPrompts } from '@/lib/agents';
import type { AgentJobData, AgentJobResult } from '@/lib/types';

let agentWorker: Worker | null = null;

export async function processAgentJob(job: Job<AgentJobData>): Promise<AgentJobResult> {
  const { executionId, stepId, agentId, cvId, markdownContent, additionalContext } = job.data;

  console.log(`[Agent Worker] Processing job ${job.id} for agent ${agentId}`);

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      jobId: job.id,
    },
  });

  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    let inputMarkdown = markdownContent;
    const childrenValues = await job.getChildrenValues<AgentJobResult>();

    if (Object.keys(childrenValues).length > 0) {
      console.log(`[Agent Worker] Agent ${agent.name} received ${Object.keys(childrenValues).length} inputs`);

      const validOutputs = Object.values(childrenValues)
        .filter((v) => v && v.success && v.improvedMarkdown)
        .map((v) => v.improvedMarkdown);

      if (validOutputs.length > 0) {
        inputMarkdown = validOutputs[validOutputs.length - 1];
      }
    }

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        inputData: JSON.stringify({
          markdownLength: inputMarkdown.length,
          hasContext: !!additionalContext,
          childrenCount: Object.keys(childrenValues).length,
        }),
      },
    });

    const { system: systemPrompt, user: userPrompt } = await getAgentPrompts(
      agent.name as 'enrichisseur' | 'adaptateur' | 'contexte' | 'bio' | 'extraction',
      inputMarkdown,
      additionalContext
    );

    const improvedMarkdown = await askMistral(systemPrompt, userPrompt);

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        outputData: JSON.stringify({
          markdownLength: improvedMarkdown.length,
          agentName: agent.name,
        }),
      },
    });

    await prisma.improvement.create({
      data: {
        cvId,
        agentType: agent.name,
        prompt: userPrompt.substring(0, 1000),
        result: improvedMarkdown,
      },
    });

    const result: AgentJobResult = {
      stepId,
      agentId,
      outputData: {
        agentName: agent.name,
        processedAt: new Date().toISOString(),
      },
      improvedMarkdown,
      success: true,
    };

    console.log(`[Agent Worker] Job ${job.id} completed successfully`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Agent Worker] Job ${job.id} failed:`, errorMessage);

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    const result: AgentJobResult = {
      stepId,
      agentId,
      outputData: {},
      improvedMarkdown: markdownContent,
      success: false,
      error: errorMessage,
    };

    throw error;
  }
}

export function startAgentWorker(): Worker {
  if (agentWorker) {
    return agentWorker;
  }

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

  agentWorker = new Worker(
    QUEUE_NAMES.AGENT_EXECUTION,
    processAgentJob,
    {
      connection: getRedisConnection(),
      concurrency,
    }
  );

  agentWorker.on('completed', (job, result) => {
    console.log(`[Agent Worker] Job ${job.id} completed:`, result.agentId);
  });

  agentWorker.on('failed', (job, error) => {
    console.error(`[Agent Worker] Job ${job?.id} failed:`, error.message);
  });

  agentWorker.on('error', (error) => {
    console.error('[Agent Worker] Worker error:', error.message);
  });

  console.log(`[Agent Worker] Started with concurrency ${concurrency}`);
  return agentWorker;
}

export async function stopAgentWorker(): Promise<void> {
  if (agentWorker) {
    await agentWorker.close();
    agentWorker = null;
    console.log('[Agent Worker] Stopped');
  }
}
