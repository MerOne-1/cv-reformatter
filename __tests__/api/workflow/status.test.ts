import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    workflowExecution: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workflowStep: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/queue', () => ({
  getAgentExecutionQueue: vi.fn(() => ({
    getJob: vi.fn().mockResolvedValue({
      remove: vi.fn().mockResolvedValue(undefined),
    }),
  })),
  getWorkflowOrchestrationQueue: vi.fn(() => ({
    getJob: vi.fn().mockResolvedValue({
      remove: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

import prisma from '@/lib/db';
import { GET as getStatus } from '@/app/api/workflow/status/[executionId]/route';
import { GET as getDetails, DELETE } from '@/app/api/workflow/[executionId]/route';

const createContext = (executionId: string) => ({
  params: Promise.resolve({ executionId }),
});

describe('Workflow Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/workflow/status/[executionId]', () => {
    it('should return workflow status with progress', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'RUNNING',
        error: null,
        startedAt: new Date(),
        completedAt: null,
        steps: [
          {
            id: 'step-1',
            status: 'COMPLETED',
            startedAt: new Date(),
            completedAt: new Date(),
            error: null,
            agent: { name: 'enrichisseur', displayName: 'Enrichisseur' },
          },
          {
            id: 'step-2',
            status: 'RUNNING',
            startedAt: new Date(),
            completedAt: null,
            error: null,
            agent: { name: 'adaptateur', displayName: 'Adaptateur' },
          },
          {
            id: 'step-3',
            status: 'PENDING',
            startedAt: null,
            completedAt: null,
            error: null,
            agent: { name: 'contexte', displayName: 'Contexte' },
          },
        ],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/status/exec-1');
      const response = await getStatus(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe('exec-1');
      expect(data.data.status).toBe('RUNNING');
      expect(data.data.progress).toEqual({
        completed: 1,
        total: 3,
        percentage: 33,
      });
      expect(data.data.steps).toHaveLength(3);
    });

    it('should return 404 when execution not found', async () => {
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/workflow/status/not-found');
      const response = await getStatus(request, createContext('not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Exécution introuvable');
      expect(response.status).toBe(404);
    });

    it('should handle completed workflow', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'COMPLETED',
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        steps: [
          { status: 'COMPLETED', agent: { name: 'test', displayName: 'Test' } },
          { status: 'COMPLETED', agent: { name: 'test2', displayName: 'Test2' } },
        ],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/status/exec-1');
      const response = await getStatus(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.data.status).toBe('COMPLETED');
      expect(data.data.progress.percentage).toBe(100);
    });

    it('should handle failed workflow with error message', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'FAILED',
        error: 'LLM API timeout',
        startedAt: new Date(),
        completedAt: new Date(),
        steps: [
          { status: 'COMPLETED', agent: { name: 'test', displayName: 'Test' } },
          { status: 'FAILED', error: 'LLM error', agent: { name: 'test2', displayName: 'Test2' } },
        ],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/status/exec-1');
      const response = await getStatus(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.data.status).toBe('FAILED');
      expect(data.data.error).toBe('LLM API timeout');
    });

    it('should handle workflow with no steps', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'PENDING',
        steps: [],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/status/exec-1');
      const response = await getStatus(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.data.progress.percentage).toBe(0);
      expect(data.data.progress.total).toBe(0);
    });
  });

  describe('GET /api/workflow/[executionId]', () => {
    it('should return detailed workflow with CV and step summary', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'RUNNING',
        cv: {
          id: 'cv-1',
          originalName: 'test.pdf',
          consultantName: 'Jean Dupont',
          status: 'EXTRACTED',
        },
        steps: [
          { status: 'COMPLETED', agent: { id: 'a1', name: 'enrichisseur', displayName: 'Enrichisseur' } },
          { status: 'RUNNING', agent: { id: 'a2', name: 'adaptateur', displayName: 'Adaptateur' } },
          { status: 'PENDING', agent: { id: 'a3', name: 'contexte', displayName: 'Contexte' } },
        ],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/exec-1');
      const response = await getDetails(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.cv.consultantName).toBe('Jean Dupont');
      expect(data.data.summary).toEqual({
        total: 3,
        pending: 1,
        waitingInputs: 0,
        running: 1,
        completed: 1,
        failed: 0,
        skipped: 0,
      });
    });

    it('should return 404 when execution not found', async () => {
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/workflow/not-found');
      const response = await getDetails(request, createContext('not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/workflow/[executionId]', () => {
    it('should cancel running workflow', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'RUNNING',
        steps: [
          { jobId: 'job-1' },
          { jobId: 'job-2' },
        ],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({ id: 'exec-1' } as any);
      vi.mocked(prisma.workflowStep.updateMany).mockResolvedValue({ count: 2 });

      const request = new NextRequest('http://localhost/api/workflow/exec-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.cancelled).toBe(true);
      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
          }),
        })
      );
    });

    it('should cancel pending workflow', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'PENDING',
        steps: [],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({ id: 'exec-1' } as any);
      vi.mocked(prisma.workflowStep.updateMany).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost/api/workflow/exec-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.cancelled).toBe(true);
    });

    it('should return 404 when execution not found', async () => {
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/workflow/not-found', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should reject cancellation of completed workflow', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'COMPLETED',
        steps: [],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/exec-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('terminée');
      expect(response.status).toBe(400);
    });

    it('should reject cancellation of failed workflow', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'FAILED',
        steps: [],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/exec-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('exec-1'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should update pending steps to skipped', async () => {
      const mockExecution = {
        id: 'exec-1',
        status: 'RUNNING',
        steps: [{ jobId: 'job-1' }],
      };

      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(mockExecution as any);
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({ id: 'exec-1' } as any);
      vi.mocked(prisma.workflowStep.updateMany).mockResolvedValue({ count: 2 });

      const request = new NextRequest('http://localhost/api/workflow/exec-1', {
        method: 'DELETE',
      });
      await DELETE(request, createContext('exec-1'));

      expect(prisma.workflowStep.updateMany).toHaveBeenCalledWith({
        where: {
          executionId: 'exec-1',
          status: { in: ['PENDING', 'WAITING_INPUTS', 'RUNNING'] },
        },
        data: expect.objectContaining({
          status: 'SKIPPED',
        }),
      });
    });
  });
});
