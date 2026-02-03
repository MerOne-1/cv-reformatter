import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    aIAgent: {
      findMany: vi.fn(),
    },
    agentConnection: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/db';
import { GET } from '@/app/api/agents/graph/route';

const emptyContext = { params: Promise.resolve({}) };

describe('Agent Graph API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agents/graph', () => {
    it('should return valid linear graph (A → B → C)', async () => {
      const mockAgents = [
        { id: 'a1', name: 'extraction', displayName: 'Extraction', isActive: true, order: 1, positionX: 0, positionY: 0 },
        { id: 'a2', name: 'enrichisseur', displayName: 'Enrichisseur', isActive: true, order: 2, positionX: 200, positionY: 0 },
        { id: 'a3', name: 'adaptateur', displayName: 'Adaptateur', isActive: true, order: 3, positionX: 400, positionY: 0 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a2', isActive: true },
        { id: 'c2', sourceAgentId: 'a2', targetAgentId: 'a3', isActive: true },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.isValid).toBe(true);
      expect(data.data.nodes).toHaveLength(3);
      expect(data.data.edges).toHaveLength(2);
      expect(data.data.validationErrors).toHaveLength(0);

      // Check levels
      const extractionNode = data.data.nodes.find((n: any) => n.name === 'extraction');
      const enrichisseurNode = data.data.nodes.find((n: any) => n.name === 'enrichisseur');
      const adaptateurNode = data.data.nodes.find((n: any) => n.name === 'adaptateur');

      expect(extractionNode.level).toBe(0);
      expect(enrichisseurNode.level).toBe(1);
      expect(adaptateurNode.level).toBe(2);
    });

    it('should return valid fan-out graph (A → B, A → C)', async () => {
      const mockAgents = [
        { id: 'a1', name: 'root', displayName: 'Root', isActive: true, order: 1 },
        { id: 'a2', name: 'branch1', displayName: 'Branch 1', isActive: true, order: 2 },
        { id: 'a3', name: 'branch2', displayName: 'Branch 2', isActive: true, order: 3 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a2', isActive: true },
        { id: 'c2', sourceAgentId: 'a1', targetAgentId: 'a3', isActive: true },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.data.isValid).toBe(true);

      const rootNode = data.data.nodes.find((n: any) => n.name === 'root');
      expect(rootNode.outputs).toHaveLength(2);
      expect(rootNode.inputs).toHaveLength(0);
    });

    it('should return valid fan-in graph (A → C, B → C)', async () => {
      const mockAgents = [
        { id: 'a1', name: 'input1', displayName: 'Input 1', isActive: true, order: 1 },
        { id: 'a2', name: 'input2', displayName: 'Input 2', isActive: true, order: 2 },
        { id: 'a3', name: 'merger', displayName: 'Merger', isActive: true, order: 3 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a3', isActive: true },
        { id: 'c2', sourceAgentId: 'a2', targetAgentId: 'a3', isActive: true },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.data.isValid).toBe(true);

      const mergerNode = data.data.nodes.find((n: any) => n.name === 'merger');
      expect(mergerNode.inputs).toHaveLength(2);
      expect(mergerNode.level).toBe(1);
    });

    it('should detect cycle in graph (A → B → A)', async () => {
      const mockAgents = [
        { id: 'a1', name: 'agent1', displayName: 'Agent 1', isActive: true, order: 1 },
        { id: 'a2', name: 'agent2', displayName: 'Agent 2', isActive: true, order: 2 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a2', isActive: true },
        { id: 'c2', sourceAgentId: 'a2', targetAgentId: 'a1', isActive: true }, // Creates cycle
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.data.isValid).toBe(false);
      expect(data.data.validationErrors).toContain('Le graphe contient un cycle');
    });

    it('should detect self-loop cycle (A → A)', async () => {
      const mockAgents = [
        { id: 'a1', name: 'agent1', displayName: 'Agent 1', isActive: true, order: 1 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a1', isActive: true }, // Self-loop
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.data.isValid).toBe(false);
      expect(data.data.validationErrors).toContain('Le graphe contient un cycle');
    });

    it('should handle empty graph', async () => {
      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.nodes).toHaveLength(0);
      expect(data.data.edges).toHaveLength(0);
      expect(data.data.isValid).toBe(true);
    });

    it('should handle disconnected agents', async () => {
      const mockAgents = [
        { id: 'a1', name: 'agent1', displayName: 'Agent 1', isActive: true, order: 1 },
        { id: 'a2', name: 'agent2', displayName: 'Agent 2', isActive: true, order: 2 },
        { id: 'a3', name: 'agent3', displayName: 'Agent 3', isActive: true, order: 3 },
      ];

      const mockConnections: any[] = []; // No connections

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.data.isValid).toBe(true);
      // All nodes at level 0 since no connections
      for (const node of data.data.nodes) {
        expect(node.level).toBe(0);
      }
    });

    it('should include only active connections', async () => {
      const mockAgents = [
        { id: 'a1', name: 'agent1', displayName: 'Agent 1', isActive: true, order: 1 },
        { id: 'a2', name: 'agent2', displayName: 'Agent 2', isActive: true, order: 2 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a2', isActive: true },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(prisma.agentConnection.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.anything(),
      });
    });

    it('should include inactive agents in graph', async () => {
      const mockAgents = [
        { id: 'a1', name: 'active', displayName: 'Active', isActive: true, order: 1 },
        { id: 'a2', name: 'inactive', displayName: 'Inactive', isActive: false, order: 2 },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      expect(data.data.nodes).toHaveLength(2);
      const inactiveNode = data.data.nodes.find((n: any) => n.name === 'inactive');
      expect(inactiveNode.isActive).toBe(false);
    });

    it('should compute levels correctly for complex DAG', async () => {
      // Graph: A → B → D
      //        A → C → D
      const mockAgents = [
        { id: 'a1', name: 'A', displayName: 'A', isActive: true, order: 1 },
        { id: 'a2', name: 'B', displayName: 'B', isActive: true, order: 2 },
        { id: 'a3', name: 'C', displayName: 'C', isActive: true, order: 3 },
        { id: 'a4', name: 'D', displayName: 'D', isActive: true, order: 4 },
      ];

      const mockConnections = [
        { id: 'c1', sourceAgentId: 'a1', targetAgentId: 'a2', isActive: true },
        { id: 'c2', sourceAgentId: 'a1', targetAgentId: 'a3', isActive: true },
        { id: 'c3', sourceAgentId: 'a2', targetAgentId: 'a4', isActive: true },
        { id: 'c4', sourceAgentId: 'a3', targetAgentId: 'a4', isActive: true },
      ];

      vi.mocked(prisma.aIAgent.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.agentConnection.findMany).mockResolvedValue(mockConnections as any);

      const request = new NextRequest('http://localhost/api/agents/graph');
      const response = await GET(request, emptyContext);
      const data = await response.json();

      const nodeA = data.data.nodes.find((n: any) => n.name === 'A');
      const nodeB = data.data.nodes.find((n: any) => n.name === 'B');
      const nodeC = data.data.nodes.find((n: any) => n.name === 'C');
      const nodeD = data.data.nodes.find((n: any) => n.name === 'D');

      expect(nodeA.level).toBe(0);
      expect(nodeB.level).toBe(1);
      expect(nodeC.level).toBe(1);
      expect(nodeD.level).toBe(2); // Max of B and C levels + 1
    });
  });
});
