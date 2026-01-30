import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    aIAgent: {
      findMany: vi.fn(),
    },
    agentConnection: {
      findMany: vi.fn(),
    },
    workflowStep: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/queue/connection', () => ({
  getRedisConnection: vi.fn(() => ({
    on: vi.fn(),
    quit: vi.fn(),
  })),
}));

vi.mock('bullmq', () => ({
  FlowProducer: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ job: { id: 'test-job-id' } }),
    close: vi.fn(),
  })),
  Queue: vi.fn(),
  Worker: vi.fn(),
}));

import prisma from '@/lib/db';

describe('Flow Producer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAgentWorkflow', () => {
    it('should throw error when no active agents found', async () => {
      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue([]);

      const { createAgentWorkflow } = await import('@/lib/queue/flow-producer');

      await expect(
        createAgentWorkflow('exec-1', 'cv-1', '# Test Markdown')
      ).rejects.toThrow('Aucun agent actif trouvé');
    });

    it('should create workflow for single agent with no connections', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'enrichisseur' },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workflowStep.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.workflowStep.findMany).mockResolvedValue([
        { id: 'step-1', agentId: 'agent-1' },
      ] as any);

      const { createAgentWorkflow, getFlowProducer } = await import('@/lib/queue/flow-producer');
      const flowProducer = getFlowProducer();

      await createAgentWorkflow('exec-1', 'cv-1', '# Test Markdown');

      expect(flowProducer.add).toHaveBeenCalled();
    });

    it('should create linear workflow with two connected agents', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'enrichisseur' },
        { id: 'agent-2', name: 'adaptateur' },
      ];

      const mockConnections = [
        { sourceAgentId: 'agent-1', targetAgentId: 'agent-2' },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);
      vi.mocked(prisma.workflowStep.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.workflowStep.findMany).mockResolvedValue([
        { id: 'step-1', agentId: 'agent-1' },
        { id: 'step-2', agentId: 'agent-2' },
      ] as any);

      const { createAgentWorkflow, getFlowProducer } = await import('@/lib/queue/flow-producer');
      const flowProducer = getFlowProducer();

      await createAgentWorkflow('exec-1', 'cv-1', '# Test Markdown');

      expect(flowProducer.add).toHaveBeenCalled();
      expect(prisma.workflowStep.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ agentId: 'agent-1' }),
          expect.objectContaining({ agentId: 'agent-2' }),
        ]),
      });
    });

    it('should create fan-out workflow (1 agent to 3 agents)', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'root' },
        { id: 'agent-2', name: 'child-1' },
        { id: 'agent-3', name: 'child-2' },
        { id: 'agent-4', name: 'child-3' },
      ];

      const mockConnections = [
        { sourceAgentId: 'agent-1', targetAgentId: 'agent-2' },
        { sourceAgentId: 'agent-1', targetAgentId: 'agent-3' },
        { sourceAgentId: 'agent-1', targetAgentId: 'agent-4' },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);
      vi.mocked(prisma.workflowStep.createMany).mockResolvedValue({ count: 4 });
      vi.mocked(prisma.workflowStep.findMany).mockResolvedValue([
        { id: 'step-1', agentId: 'agent-1' },
        { id: 'step-2', agentId: 'agent-2' },
        { id: 'step-3', agentId: 'agent-3' },
        { id: 'step-4', agentId: 'agent-4' },
      ] as any);

      const { createAgentWorkflow } = await import('@/lib/queue/flow-producer');

      await createAgentWorkflow('exec-1', 'cv-1', '# Test Markdown');

      expect(prisma.workflowStep.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ agentId: 'agent-1' }),
          expect.objectContaining({ agentId: 'agent-2' }),
          expect.objectContaining({ agentId: 'agent-3' }),
          expect.objectContaining({ agentId: 'agent-4' }),
        ]),
      });
    });

    it('should create fan-in workflow (3 agents to 1 agent)', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'source-1' },
        { id: 'agent-2', name: 'source-2' },
        { id: 'agent-3', name: 'source-3' },
        { id: 'agent-4', name: 'collector' },
      ];

      const mockConnections = [
        { sourceAgentId: 'agent-1', targetAgentId: 'agent-4' },
        { sourceAgentId: 'agent-2', targetAgentId: 'agent-4' },
        { sourceAgentId: 'agent-3', targetAgentId: 'agent-4' },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);
      vi.mocked(prisma.workflowStep.createMany).mockResolvedValue({ count: 4 });
      vi.mocked(prisma.workflowStep.findMany).mockResolvedValue([
        { id: 'step-1', agentId: 'agent-1' },
        { id: 'step-2', agentId: 'agent-2' },
        { id: 'step-3', agentId: 'agent-3' },
        { id: 'step-4', agentId: 'agent-4' },
      ] as any);

      const { createAgentWorkflow, getFlowProducer } = await import('@/lib/queue/flow-producer');
      const flowProducer = getFlowProducer();

      await createAgentWorkflow('exec-1', 'cv-1', '# Test Markdown');

      expect(flowProducer.add).toHaveBeenCalled();
    });
  });
});
