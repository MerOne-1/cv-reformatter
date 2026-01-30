import { QueueEvents } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAMES } from './queues';
import prisma from '@/lib/db';

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
        const result = JSON.parse(returnvalue);
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
              await prisma.workflowExecution.update({
                where: { id: step.executionId },
                data: {
                  status: 'COMPLETED',
                  completedAt: new Date(),
                },
              });

              const lastStep = allSteps
                .filter((s) => s.status === 'COMPLETED' && s.outputData)
                .sort((a, b) => {
                  const aTime = a.completedAt?.getTime() || 0;
                  const bTime = b.completedAt?.getTime() || 0;
                  return bTime - aTime;
                })[0];

              if (lastStep?.outputData) {
                await prisma.workflowExecution.update({
                  where: { id: step.executionId },
                  data: { outputData: lastStep.outputData },
                });
              }

              console.log(`[Events] Workflow ${step.executionId} completed`);
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
        }
      } catch (error) {
        console.error('[Events] Error processing failure:', error);
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
