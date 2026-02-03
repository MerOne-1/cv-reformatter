import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection';
import { QUEUE_NAMES } from '../queues';
import prisma from '@/lib/db';
import { askLLM } from '@/lib/llm';
import { getAgentPrompts } from '@/lib/agents';
import type { AgentJobData, AgentJobResult } from '@/lib/types';

let agentWorker: Worker | null = null;

export async function processAgentJob(job: Job<AgentJobData>): Promise<AgentJobResult> {
  const { executionId, stepId, agentId, cvId, markdownContent, pastMissionNotes, futureMissionNotes } = job.data;

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

      // Tri déterministe par clé (job key contient l'agentId) pour éviter un comportement aléatoire
      // Format de clé: "bull:agent-execution:exec-{executionId}-agent-{agentId}"
      const sortedEntries = Object.entries(childrenValues)
        .filter(([, v]) => v && v.success && v.improvedMarkdown)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

      if (sortedEntries.length === 1) {
        // Un seul parent: utiliser son output directement
        inputMarkdown = sortedEntries[0][1].improvedMarkdown;
      } else if (sortedEntries.length > 1) {
        // Plusieurs parents: prendre le dernier dans l'ordre alphabétique (déterministe)
        // Note: pour un vrai merge intelligent, il faudrait une stratégie de fusion métier
        inputMarkdown = sortedEntries[sortedEntries.length - 1][1].improvedMarkdown;
        console.log(`[Agent Worker] Multiple parents (${sortedEntries.length}), using last in sorted order`);
      }
    }

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        inputData: JSON.stringify({
          markdownLength: inputMarkdown.length,
          hasPastMissionNotes: !!pastMissionNotes,
          hasFutureMissionNotes: !!futureMissionNotes,
          childrenCount: Object.keys(childrenValues).length,
        }),
      },
    });

    const { system: systemPrompt, user: userPrompt } = await getAgentPrompts(
      agent.name as 'enrichisseur' | 'adaptateur' | 'contexte' | 'bio' | 'extraction',
      {
        markdown: inputMarkdown,
        pastMissionNotes,
        futureMissionNotes,
      }
    );

    // Mesurer la durée de l'appel LLM
    const startTime = Date.now();
    const improvedMarkdown = await askLLM(systemPrompt, userPrompt);
    const durationMs = Date.now() - startTime;

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

    // Créer le log détaillé de l'exécution
    await prisma.agentExecutionLog.create({
      data: {
        agentId,
        cvId,
        executionId,
        stepId,
        systemPrompt,
        userPrompt,
        inputMarkdown,
        pastMissionNotes: pastMissionNotes || null,
        futureMissionNotes: futureMissionNotes || null,
        outputMarkdown: improvedMarkdown,
        durationMs,
        success: true,
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

  // Timeout de 5 minutes pour les appels LLM (lockDuration doit être > temps d'exécution max)
  const lockDuration = parseInt(process.env.WORKER_LOCK_DURATION || '300000', 10); // 5 min

  agentWorker = new Worker(
    QUEUE_NAMES.AGENT_EXECUTION,
    processAgentJob,
    {
      connection: getRedisConnection(),
      concurrency,
      lockDuration,
      stalledInterval: 30000, // Vérifier les jobs stalled toutes les 30s
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
