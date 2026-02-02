import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    cV: {
      findUnique: vi.fn(),
    },
    aIAgent: {
      findMany: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/queue', () => ({
  getWorkflowOrchestrationQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  })),
}));

import prisma from '@/lib/db';
import { POST } from '@/app/api/workflow/execute/route';

// Helper to create context for routes without params
const emptyContext = { params: Promise.resolve({}) };

describe('Workflow Execute API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/workflow/execute', () => {
    it('should create and queue a new workflow execution', async () => {
      const mockCV = {
        id: 'cv-1',
        markdownContent: '# Test CV',
        status: 'EXTRACTED',
      };

      const mockAgents = [
        { id: 'agent-1' },
        { id: 'agent-2' },
      ];

      const mockExecution = {
        id: 'exec-1',
        cvId: 'cv-1',
        status: 'PENDING',
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.workflowExecution.create).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/execute', {
        method: 'POST',
        body: JSON.stringify({ cvId: 'cv-1' }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.executionId).toBe('exec-1');
      expect(data.data.status).toBe('PENDING');
    });

    it('should reject when CV not found', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/workflow/execute', {
        method: 'POST',
        body: JSON.stringify({ cvId: 'cv-not-found' }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('introuvable');
      expect(response.status).toBe(404);
    });

    it('should reject when CV has no markdown content', async () => {
      const mockCV = {
        id: 'cv-1',
        markdownContent: null,
        status: 'PENDING',
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);

      const request = new NextRequest('http://localhost/api/workflow/execute', {
        method: 'POST',
        body: JSON.stringify({ cvId: 'cv-1' }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('extrait');
      expect(response.status).toBe(400);
    });

    it('should reject when no active agents configured', async () => {
      const mockCV = {
        id: 'cv-1',
        markdownContent: '# Test CV',
        status: 'EXTRACTED',
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/workflow/execute', {
        method: 'POST',
        body: JSON.stringify({ cvId: 'cv-1' }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Aucun agent actif');
      expect(response.status).toBe(400);
    });

    it('should pass additional context when provided', async () => {
      const mockCV = {
        id: 'cv-1',
        markdownContent: '# Test CV',
        status: 'EXTRACTED',
      };

      const mockAgents = [{ id: 'agent-1' }];

      const mockExecution = {
        id: 'exec-1',
        cvId: 'cv-1',
        status: 'PENDING',
        inputData: JSON.stringify({ additionalContext: 'Mission Java' }),
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.workflowExecution.create).mockResolvedValue(mockExecution as any);

      const request = new NextRequest('http://localhost/api/workflow/execute', {
        method: 'POST',
        body: JSON.stringify({
          cvId: 'cv-1',
          additionalContext: 'Mission Java',
        }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(prisma.workflowExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inputData: expect.stringContaining('Mission Java'),
        }),
      });
    });
  });
});
