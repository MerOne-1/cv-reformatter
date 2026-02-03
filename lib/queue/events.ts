import { QueueEvents } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAMES } from './queues';
import prisma from '@/lib/db';
import { detectMissingFields } from '@/lib/types';

const WORKFLOW_COMPLETE_LOCK_TTL = 60; // secondes

let agentQueueEvents: QueueEvents | null = null;
let orchestratorQueueEvents: QueueEvents | null = null;

export function getAgentQueueEvents(): QueueEvents {
  if (!agentQueueEvents) {
    agentQueueEvents = new QueueEvents(QUEUE_NAMES.AGENT_EXECUTION, {
      connection: getRedisConnection(),
    });

    agentQueueEvents.on('completed', async ({ jobId, returnvalue }) => {
      console.log(`[Events] Agent job ${jobId} completed`);

      try {
        // returnvalue peut être une string JSON ou déjà un objet
        const result = typeof returnvalue === 'string'
          ? JSON.parse(returnvalue)
          : returnvalue;
        if (result.stepId) {
          const step = await prisma.workflowStep.findUnique({
            where: { id: result.stepId },
            include: { execution: true },
          });

          if (step) {
            const allSteps = await prisma.workflowStep.findMany({
              where: { executionId: step.executionId },
            });

            const allCompleted = allSteps.every(
              (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
            );
            const anyFailed = allSteps.some((s) => s.status === 'FAILED');

            if (allCompleted && !anyFailed) {
              // Lock distribué pour éviter que plusieurs workers ne finalisent le même workflow
              const redis = getRedisConnection();
              const lockKey = `workflow-complete-lock:${step.executionId}`;
              const acquired = await redis.set(lockKey, '1', 'EX', WORKFLOW_COMPLETE_LOCK_TTL, 'NX');

              if (!acquired) {
                console.log(`[Events] Lock not acquired for ${step.executionId}, another worker is finalizing`);
                return;
              }

              try {
                // Récupérer le log de l'agent feuille pour avoir le markdown final
                // On utilise isLeafAgent au lieu de createdAt pour un comportement déterministe
                const leafStep = allSteps.find((s) => s.isLeafAgent && s.status === 'COMPLETED');

                const leafLog = leafStep
                  ? await prisma.agentExecutionLog.findFirst({
                      where: { stepId: leafStep.id },
                      select: { outputMarkdown: true, cvId: true },
                    })
                  : null;

                // Fallback: si pas de leaf step explicite, prendre le dernier complété
                const finalLog = leafLog || await prisma.agentExecutionLog.findFirst({
                  where: { executionId: step.executionId },
                  orderBy: { createdAt: 'desc' },
                  select: { outputMarkdown: true, cvId: true },
                });

                // Transaction atomique pour les mises à jour finales
                await prisma.$transaction(async (tx) => {
                  // Mettre à jour le CV avec le markdown final
                  if (finalLog?.outputMarkdown && finalLog.cvId) {
                    const missingFields = detectMissingFields(finalLog.outputMarkdown);
                    await tx.cV.update({
                      where: { id: finalLog.cvId },
                      data: {
                        markdownContent: finalLog.outputMarkdown,
                        missingFields,
                        status: 'IMPROVED',
                      },
                    });
                    console.log(`[Events] CV ${finalLog.cvId} updated with final markdown`);
                  }

                  // Récupérer le outputData du leaf step
                  const leafOutputData = leafStep?.outputData || allSteps
                    .filter((s) => s.status === 'COMPLETED' && s.outputData)
                    .sort((a, b) => {
                      const aTime = a.completedAt?.getTime() || 0;
                      const bTime = b.completedAt?.getTime() || 0;
                      return bTime - aTime;
                    })[0]?.outputData;

                  await tx.workflowExecution.update({
                    where: { id: step.executionId },
                    data: {
                      status: 'COMPLETED',
                      completedAt: new Date(),
                      outputData: leafOutputData || undefined,
                    },
                  });
                });

                console.log(`[Events] Workflow ${step.executionId} completed`);
              } finally {
                // Libérer le lock
                await redis.del(lockKey);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Events] Error processing completion:', error);
      }
    });

    agentQueueEvents.on('failed', async ({ jobId, failedReason }) => {
      console.error(`[Events] Agent job ${jobId} failed:`, failedReason);

      try {
        const step = await prisma.workflowStep.findFirst({
          where: { jobId },
        });

        if (step) {
          await prisma.workflowExecution.update({
            where: { id: step.executionId },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              error: `Agent job failed: ${failedReason}`,
            },
          });
          console.log(`[Events] Workflow ${step.executionId} marked as FAILED`);
        } else {
          // Fallback: essayer d'extraire l'executionId du jobId (format: exec-{executionId}-agent-{agentId})
          const match = jobId.match(/^exec-([^-]+(?:-[^-]+)*)-agent-/);
          if (match) {
            const executionId = match[1];
            console.warn(`[Events] Step not found for job ${jobId}, using fallback executionId: ${executionId}`);
            await prisma.workflowExecution.update({
              where: { id: executionId },
              data: {
                status: 'FAILED',
                completedAt: new Date(),
                error: `Agent job failed (step not found): ${failedReason}`,
              },
            });
            console.log(`[Events] Workflow ${executionId} marked as FAILED via fallback`);
          } else {
            console.error(`[Events] Could not find execution for failed job ${jobId}`);
          }
        }
      } catch (error) {
        console.error('[Events] Error processing failure:', error);
        // Tentative de dernière chance: marquer toutes les exécutions RUNNING comme à vérifier
        try {
          const stuckExecutions = await prisma.workflowExecution.findMany({
            where: { status: 'RUNNING' },
            select: { id: true },
          });
          if (stuckExecutions.length > 0) {
            console.warn(`[Events] Found ${stuckExecutions.length} stuck executions during error recovery`);
          }
        } catch {
          // Ignore - on a déjà loggé l'erreur principale
        }
      }
    });

    agentQueueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[Events] Agent job ${jobId} progress:`, data);
    });
  }

  return agentQueueEvents;
}

export function getOrchestratorQueueEvents(): QueueEvents {
  if (!orchestratorQueueEvents) {
    orchestratorQueueEvents = new QueueEvents(QUEUE_NAMES.WORKFLOW_ORCHESTRATION, {
      connection: getRedisConnection(),
    });

    orchestratorQueueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[Events] Orchestrator job ${jobId} completed:`, returnvalue);
    });

    orchestratorQueueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[Events] Orchestrator job ${jobId} failed:`, failedReason);
    });
  }

  return orchestratorQueueEvents;
}

export async function closeQueueEvents(): Promise<void> {
  const events = [agentQueueEvents, orchestratorQueueEvents];
  await Promise.all(events.filter(Boolean).map((e) => e!.close()));
  agentQueueEvents = null;
  orchestratorQueueEvents = null;
  console.log('[Events] All queue events closed');
}
