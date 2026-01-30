import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FlowProducer, Worker, Job, Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const TEST_QUEUE_NAME = 'test-agent-execution';
const TEST_REDIS_PREFIX = 'test:workflow:';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

interface TestJobData {
  executionId: string;
  agentId: string;
  agentName: string;
  input: string;
  shouldFail?: boolean;
  delayMs?: number;
}

interface TestJobResult {
  agentId: string;
  output: string;
  success: boolean;
  timestamp: number;
}

describe('Workflow Integration Tests (Redis réel)', () => {
  let redis: Redis;
  let flowProducer: FlowProducer;
  let worker: Worker;
  let queue: Queue;
  let queueEvents: QueueEvents;

  const processedJobs: string[] = [];
  const jobResults: Map<string, TestJobResult> = new Map();

  beforeAll(async () => {
    redis = new Redis(redisConfig);
    await redis.ping();

    flowProducer = new FlowProducer({
      connection: redisConfig,
      prefix: TEST_REDIS_PREFIX,
    });

    queue = new Queue(TEST_QUEUE_NAME, {
      connection: redisConfig,
      prefix: TEST_REDIS_PREFIX,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });

    queueEvents = new QueueEvents(TEST_QUEUE_NAME, {
      connection: redisConfig,
      prefix: TEST_REDIS_PREFIX,
    });

    worker = new Worker<TestJobData, TestJobResult>(
      TEST_QUEUE_NAME,
      async (job: Job<TestJobData>) => {
        const { agentId, agentName, input, shouldFail, delayMs } = job.data;

        if (delayMs) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (shouldFail) {
          throw new Error(`Agent ${agentName} failed intentionally`);
        }

        const childrenValues = await job.getChildrenValues<TestJobResult>();
        const childInputs = Object.values(childrenValues)
          .filter((v) => v?.success)
          .map((v) => v.output);

        const combinedInput = childInputs.length > 0
          ? childInputs.join(' + ')
          : input;

        processedJobs.push(agentId);

        const result: TestJobResult = {
          agentId,
          output: `${agentName}(${combinedInput})`,
          success: true,
          timestamp: Date.now(),
        };

        jobResults.set(agentId, result);
        return result;
      },
      {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
        concurrency: 3,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (worker) await worker.close();
    if (queue) await queue.close();
    if (queueEvents) await queueEvents.close();
    if (flowProducer) await flowProducer.close();

    const keys = await redis.keys(`${TEST_REDIS_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    if (redis) await redis.quit();
  });

  beforeEach(() => {
    processedJobs.length = 0;
    jobResults.clear();
  });

  describe('Linear Workflow (A → B → C)', () => {
    it('should execute agents in order respecting dependencies', async () => {
      const executionId = `exec-linear-${Date.now()}`;

      const flow = await flowProducer.add({
        name: 'agent-C',
        queueName: TEST_QUEUE_NAME,
        data: {
          executionId,
          agentId: 'agent-c',
          agentName: 'AgentC',
          input: 'start',
        },
        opts: { jobId: `${executionId}-c` },
        children: [
          {
            name: 'agent-B',
            queueName: TEST_QUEUE_NAME,
            data: {
              executionId,
              agentId: 'agent-b',
              agentName: 'AgentB',
              input: 'start',
            },
            opts: { jobId: `${executionId}-b` },
            children: [
              {
                name: 'agent-A',
                queueName: TEST_QUEUE_NAME,
                data: {
                  executionId,
                  agentId: 'agent-a',
                  agentName: 'AgentA',
                  input: 'start',
                },
                opts: { jobId: `${executionId}-a` },
              },
            ],
          },
        ],
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
        queueEvents.on('completed', ({ jobId }) => {
          if (jobId === `${executionId}-c`) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      expect(processedJobs).toHaveLength(3);
      expect(processedJobs.indexOf('agent-a')).toBeLessThan(processedJobs.indexOf('agent-b'));
      expect(processedJobs.indexOf('agent-b')).toBeLessThan(processedJobs.indexOf('agent-c'));

      const resultC = jobResults.get('agent-c');
      expect(resultC?.output).toBe('AgentC(AgentB(AgentA(start)))');
    });
  });

  describe('Fan-In Workflow (A, B → C)', () => {
    it('should wait for all parent agents before executing child', async () => {
      const executionId = `exec-fanin-${Date.now()}`;

      await flowProducer.add({
        name: 'agent-collector',
        queueName: TEST_QUEUE_NAME,
        data: {
          executionId,
          agentId: 'collector',
          agentName: 'Collector',
          input: 'base',
        },
        opts: {
          jobId: `${executionId}-collector`,
          failParentOnFailure: true,
        },
        children: [
          {
            name: 'agent-source-1',
            queueName: TEST_QUEUE_NAME,
            data: {
              executionId,
              agentId: 'source-1',
              agentName: 'Source1',
              input: 'data1',
              delayMs: 100,
            },
            opts: { jobId: `${executionId}-source-1` },
          },
          {
            name: 'agent-source-2',
            queueName: TEST_QUEUE_NAME,
            data: {
              executionId,
              agentId: 'source-2',
              agentName: 'Source2',
              input: 'data2',
              delayMs: 50,
            },
            opts: { jobId: `${executionId}-source-2` },
          },
        ],
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
        queueEvents.on('completed', ({ jobId }) => {
          if (jobId === `${executionId}-collector`) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      expect(processedJobs).toContain('source-1');
      expect(processedJobs).toContain('source-2');
      expect(processedJobs).toContain('collector');

      const collectorIdx = processedJobs.indexOf('collector');
      const source1Idx = processedJobs.indexOf('source-1');
      const source2Idx = processedJobs.indexOf('source-2');
      expect(collectorIdx).toBeGreaterThan(source1Idx);
      expect(collectorIdx).toBeGreaterThan(source2Idx);

      const result = jobResults.get('collector');
      expect(result?.output).toContain('Source1(data1)');
      expect(result?.output).toContain('Source2(data2)');
    });
  });

  describe('Fan-Out Workflow (A → B, C, D)', () => {
    it('should execute children in parallel after parent', async () => {
      const executionId = `exec-fanout-${Date.now()}`;

      await flowProducer.add({
        name: 'root-agent',
        queueName: TEST_QUEUE_NAME,
        data: {
          executionId,
          agentId: 'root',
          agentName: 'Root',
          input: 'initial',
        },
        opts: { jobId: `${executionId}-root` },
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        queueEvents.on('completed', ({ jobId }) => {
          if (jobId === `${executionId}-root`) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      const children = await Promise.all([
        flowProducer.add({
          name: 'child-1',
          queueName: TEST_QUEUE_NAME,
          data: {
            executionId,
            agentId: 'child-1',
            agentName: 'Child1',
            input: 'from-root',
          },
          opts: { jobId: `${executionId}-child-1` },
        }),
        flowProducer.add({
          name: 'child-2',
          queueName: TEST_QUEUE_NAME,
          data: {
            executionId,
            agentId: 'child-2',
            agentName: 'Child2',
            input: 'from-root',
          },
          opts: { jobId: `${executionId}-child-2` },
        }),
        flowProducer.add({
          name: 'child-3',
          queueName: TEST_QUEUE_NAME,
          data: {
            executionId,
            agentId: 'child-3',
            agentName: 'Child3',
            input: 'from-root',
          },
          opts: { jobId: `${executionId}-child-3` },
        }),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(processedJobs).toContain('root');
      expect(processedJobs).toContain('child-1');
      expect(processedJobs).toContain('child-2');
      expect(processedJobs).toContain('child-3');
      expect(processedJobs.indexOf('root')).toBe(0);
    });
  });

  describe('Error Propagation (failParentOnFailure)', () => {
    it('should propagate failure to parent when child fails', async () => {
      const executionId = `exec-error-${Date.now()}`;
      let childFailed = false;
      let parentFailed = false;

      const failListener = ({ jobId }: { jobId: string }) => {
        if (jobId === `${executionId}-failing-child`) {
          childFailed = true;
        }
        if (jobId === `${executionId}-parent`) {
          parentFailed = true;
        }
      };

      queueEvents.on('failed', failListener);

      await flowProducer.add({
        name: 'parent-agent',
        queueName: TEST_QUEUE_NAME,
        data: {
          executionId,
          agentId: 'parent',
          agentName: 'Parent',
          input: 'start',
        },
        opts: {
          jobId: `${executionId}-parent`,
          failParentOnFailure: true,
        },
        children: [
          {
            name: 'failing-child',
            queueName: TEST_QUEUE_NAME,
            data: {
              executionId,
              agentId: 'failing-child',
              agentName: 'FailingChild',
              input: 'will-fail',
              shouldFail: true,
            },
            opts: {
              jobId: `${executionId}-failing-child`,
              failParentOnFailure: true,
              attempts: 1,
            },
          },
        ],
      });

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (childFailed && parentFailed) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 8000);
      });

      queueEvents.off('failed', failListener);

      expect(childFailed).toBe(true);
      expect(parentFailed).toBe(true);
      expect(processedJobs).not.toContain('parent');
    }, 15000);

    it('should record child failure without affecting sibling execution', async () => {
      const executionId = `exec-sibling-${Date.now()}`;
      let childFailed = false;
      let siblingCompleted = false;

      const failListener = ({ jobId }: { jobId: string }) => {
        if (jobId === `${executionId}-failing-child`) {
          childFailed = true;
        }
      };

      const completeListener = ({ jobId }: { jobId: string }) => {
        if (jobId === `${executionId}-sibling-child`) {
          siblingCompleted = true;
        }
      };

      queueEvents.on('failed', failListener);
      queueEvents.on('completed', completeListener);

      await flowProducer.add({
        name: 'parent-with-siblings',
        queueName: TEST_QUEUE_NAME,
        data: {
          executionId,
          agentId: 'parent-siblings',
          agentName: 'ParentSiblings',
          input: 'start',
        },
        opts: {
          jobId: `${executionId}-parent-siblings`,
        },
        children: [
          {
            name: 'failing-child',
            queueName: TEST_QUEUE_NAME,
            data: {
              executionId,
              agentId: 'failing-child',
              agentName: 'FailingChild',
              input: 'will-fail',
              shouldFail: true,
            },
            opts: {
              jobId: `${executionId}-failing-child`,
              failParentOnFailure: false,
              attempts: 1,
            },
          },
          {
            name: 'sibling-child',
            queueName: TEST_QUEUE_NAME,
            data: {
              executionId,
              agentId: 'sibling-child',
              agentName: 'SiblingChild',
              input: 'ok',
            },
            opts: {
              jobId: `${executionId}-sibling-child`,
              failParentOnFailure: false,
            },
          },
        ],
      });

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (childFailed && siblingCompleted) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 8000);
      });

      queueEvents.off('failed', failListener);
      queueEvents.off('completed', completeListener);

      expect(childFailed).toBe(true);
      expect(siblingCompleted).toBe(true);
      expect(processedJobs).toContain('sibling-child');
    }, 15000);
  });

  describe('Workflow Cancellation', () => {
    it('should be able to remove a waiting job using dedicated queue', async () => {
      const executionId = `exec-cancel-${Date.now()}`;

      const cancelQueue = new Queue(`${TEST_QUEUE_NAME}-cancel-test`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      const job = await cancelQueue.add(
        'delayed-agent',
        {
          executionId,
          agentId: 'delayed',
          agentName: 'DelayedAgent',
          input: 'data',
        },
        {
          jobId: `${executionId}-delayed`,
          delay: 60000,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const fetchedJob = await cancelQueue.getJob(`${executionId}-delayed`);
      expect(fetchedJob).not.toBeNull();

      const state = await fetchedJob?.getState();
      expect(state).toBe('delayed');

      if (fetchedJob) {
        await fetchedJob.remove();
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const removedJob = await cancelQueue.getJob(`${executionId}-delayed`);
      expect(removedJob).toBeFalsy();

      await cancelQueue.close();
    });

    it('should track job state transitions correctly', async () => {
      const executionId = `exec-state-${Date.now()}`;
      const states: string[] = [];

      const stateQueue = new Queue(`${TEST_QUEUE_NAME}-state`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      const stateEvents = new QueueEvents(`${TEST_QUEUE_NAME}-state`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      const stateWorker = new Worker<TestJobData, TestJobResult>(
        `${TEST_QUEUE_NAME}-state`,
        async (job) => {
          states.push('processing');
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { agentId: job.data.agentId, output: 'done', success: true, timestamp: Date.now() };
        },
        {
          connection: redisConfig,
          prefix: TEST_REDIS_PREFIX,
          concurrency: 1,
        }
      );

      stateEvents.on('waiting', () => states.push('waiting'));
      stateEvents.on('active', () => states.push('active'));
      stateEvents.on('completed', () => states.push('completed'));

      await stateQueue.add(
        'state-job',
        {
          executionId,
          agentId: 'state-agent',
          agentName: 'StateAgent',
          input: 'data',
        },
        { jobId: `${executionId}-state` }
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));

      await stateWorker.close();
      await stateQueue.close();
      await stateEvents.close();

      expect(states).toContain('processing');
      expect(states).toContain('completed');
    }, 10000);
  });

  describe('Job Configuration', () => {
    it('should respect job attempts configuration', async () => {
      const executionId = `exec-attempts-${Date.now()}`;
      let attemptCount = 0;
      let finallyFailed = false;

      const attemptsWorker = new Worker<TestJobData, TestJobResult>(
        `${TEST_QUEUE_NAME}-attempts`,
        async (job) => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return { agentId: job.data.agentId, output: 'done', success: true, timestamp: Date.now() };
        },
        {
          connection: redisConfig,
          prefix: TEST_REDIS_PREFIX,
          concurrency: 1,
        }
      );

      const attemptsQueue = new Queue(`${TEST_QUEUE_NAME}-attempts`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      const attemptsEvents = new QueueEvents(`${TEST_QUEUE_NAME}-attempts`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      attemptsEvents.on('failed', ({ jobId }) => {
        if (jobId === `${executionId}-attempts`) {
          finallyFailed = true;
        }
      });

      await attemptsQueue.add(
        'attempts-job',
        {
          executionId,
          agentId: 'attempts-agent',
          agentName: 'AttemptsAgent',
          input: 'data',
        },
        {
          jobId: `${executionId}-attempts`,
          attempts: 1,
          backoff: { type: 'fixed', delay: 50 },
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await attemptsWorker.close();
      await attemptsQueue.close();
      await attemptsEvents.close();

      expect(attemptCount).toBe(1);
      expect(finallyFailed).toBe(true);
    }, 10000);

    it('should respect job priority', async () => {
      const executionId = `exec-priority-${Date.now()}`;
      const processOrder: string[] = [];

      const priorityQueue = new Queue(`${TEST_QUEUE_NAME}-priority`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      await priorityQueue.add(
        'low-priority',
        { executionId, agentId: 'low', agentName: 'Low', input: 'data' },
        { priority: 10, jobId: `${executionId}-low` }
      );

      await priorityQueue.add(
        'high-priority',
        { executionId, agentId: 'high', agentName: 'High', input: 'data' },
        { priority: 1, jobId: `${executionId}-high` }
      );

      const priorityWorker = new Worker<TestJobData, TestJobResult>(
        `${TEST_QUEUE_NAME}-priority`,
        async (job) => {
          processOrder.push(job.data.agentId);
          return { agentId: job.data.agentId, output: 'done', success: true, timestamp: Date.now() };
        },
        {
          connection: redisConfig,
          prefix: TEST_REDIS_PREFIX,
          concurrency: 1,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await priorityWorker.close();
      await priorityQueue.close();

      expect(processOrder[0]).toBe('high');
      expect(processOrder[1]).toBe('low');
    }, 10000);
  });

  describe('Retry Mechanism', () => {
    it('should retry failed jobs with backoff', async () => {
      const executionId = `exec-retry-${Date.now()}`;
      let attempts = 0;

      const retryWorker = new Worker<TestJobData, TestJobResult>(
        `${TEST_QUEUE_NAME}-retry`,
        async (job) => {
          attempts++;
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return {
            agentId: job.data.agentId,
            output: 'success-after-retry',
            success: true,
            timestamp: Date.now()
          };
        },
        {
          connection: redisConfig,
          prefix: TEST_REDIS_PREFIX,
          concurrency: 1,
        }
      );

      const retryQueue = new Queue(`${TEST_QUEUE_NAME}-retry`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 100,
          },
          removeOnComplete: true,
          removeOnFail: true,
        },
      });

      const retryEvents = new QueueEvents(`${TEST_QUEUE_NAME}-retry`, {
        connection: redisConfig,
        prefix: TEST_REDIS_PREFIX,
      });

      let completed = false;
      await retryQueue.add(
        'retry-job',
        {
          executionId,
          agentId: 'retry-agent',
          agentName: 'RetryAgent',
          input: 'data',
        },
        { jobId: `${executionId}-retry` }
      );

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
        retryEvents.on('completed', ({ jobId }) => {
          if (jobId === `${executionId}-retry`) {
            completed = true;
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      await retryWorker.close();
      await retryQueue.close();
      await retryEvents.close();

      expect(attempts).toBe(3);
      expect(completed).toBe(true);
    });
  });
});
