import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    agentConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aIAgent: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '@/lib/db';
import { GET, POST } from '@/app/api/agents/connections/route';

// Helper to create context for routes without params
const emptyContext = { params: Promise.resolve({}) };

describe('Agent Connections API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agents/connections', () => {
    it('should return all connections', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          sourceAgentId: 'agent-1',
          targetAgentId: 'agent-2',
          order: 0,
          isActive: true,
          sourceAgent: { id: 'agent-1', name: 'enrichisseur', displayName: 'Enrichisseur', isActive: true },
          targetAgent: { id: 'agent-2', name: 'adaptateur', displayName: 'Adaptateur', isActive: true },
        },
      ];

      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/connections');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].sourceAgent.name).toBe('enrichisseur');
    });
  });

  describe('POST /api/agents/connections', () => {
    it('should create a new connection', async () => {
      const mockSourceAgent = { id: 'agent-1', name: 'enrichisseur' };
      const mockTargetAgent = { id: 'agent-2', name: 'adaptateur' };
      const mockConnection = {
        id: 'conn-1',
        sourceAgentId: 'agent-1',
        targetAgentId: 'agent-2',
        order: 0,
        isActive: true,
        sourceAgent: { id: 'agent-1', name: 'enrichisseur', displayName: 'Enrichisseur', isActive: true },
        targetAgent: { id: 'agent-2', name: 'adaptateur', displayName: 'Adaptateur', isActive: true },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          aIAgent: {
            findUnique: vi.fn()
              .mockResolvedValueOnce(mockSourceAgent)
              .mockResolvedValueOnce(mockTargetAgent),
          },
          agentConnection: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(mockConnection),
          },
        };
        return callback(tx);
      });

      const request = new NextRequest('http://localhost/api/agents/connections', {
        method: 'POST',
        body: JSON.stringify({
          sourceAgentId: 'agent-1',
          targetAgentId: 'agent-2',
        }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.sourceAgentId).toBe('agent-1');
      expect(data.data.targetAgentId).toBe('agent-2');
    });

    it('should reject self-connection', async () => {
      const request = new NextRequest('http://localhost/api/agents/connections', {
        method: 'POST',
        body: JSON.stringify({
          sourceAgentId: 'agent-1',
          targetAgentId: 'agent-1',
        }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('lui-même');
      expect(response.status).toBe(400);
    });

    it('should reject connection when agents do not exist', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          aIAgent: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
          agentConnection: {
            findMany: vi.fn(),
            create: vi.fn(),
          },
        };
        return callback(tx);
      });

      const request = new NextRequest('http://localhost/api/agents/connections', {
        method: 'POST',
        body: JSON.stringify({
          sourceAgentId: 'agent-1',
          targetAgentId: 'agent-2',
        }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('introuvable');
      expect(response.status).toBe(404);
    });

    it('should reject connection that would create a cycle', async () => {
      const mockSourceAgent = { id: 'agent-1', name: 'enrichisseur' };
      const mockTargetAgent = { id: 'agent-2', name: 'adaptateur' };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          aIAgent: {
            findUnique: vi.fn()
              .mockResolvedValueOnce(mockSourceAgent)
              .mockResolvedValueOnce(mockTargetAgent),
          },
          agentConnection: {
            findMany: vi.fn().mockResolvedValue([{ targetAgentId: 'agent-1' }]),
            create: vi.fn(),
          },
        };
        return callback(tx);
      });

      const request = new NextRequest('http://localhost/api/agents/connections', {
        method: 'POST',
        body: JSON.stringify({
          sourceAgentId: 'agent-1',
          targetAgentId: 'agent-2',
        }),
      });

      const response = await POST(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('cycle');
      expect(response.status).toBe(400);
    });
  });
});
