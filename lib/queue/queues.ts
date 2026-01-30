import { Queue, QueueOptions } from 'bullmq';
import { getRedisConnection } from './connection';

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600,
    count: 100,
  },
  removeOnFail: {
    age: 86400,
    count: 500,
  },
};

let agentExecutionQueue: Queue | null = null;
let workflowOrchestrationQueue: Queue | null = null;

export function getAgentExecutionQueue(): Queue {
  if (!agentExecutionQueue) {
    agentExecutionQueue = new Queue('agent-execution', {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return agentExecutionQueue;
}

export function getWorkflowOrchestrationQueue(): Queue {
  if (!workflowOrchestrationQueue) {
    workflowOrchestrationQueue = new Queue('workflow-orchestration', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 1,
      },
    });
  }
  return workflowOrchestrationQueue;
}

export async function closeQueues(): Promise<void> {
  const queues = [agentExecutionQueue, workflowOrchestrationQueue];
  await Promise.all(
    queues.filter(Boolean).map((q) => q!.close())
  );
  agentExecutionQueue = null;
  workflowOrchestrationQueue = null;
  console.log('All queues closed');
}

export const QUEUE_NAMES = {
  AGENT_EXECUTION: 'agent-execution',
  WORKFLOW_ORCHESTRATION: 'workflow-orchestration',
} as const;
