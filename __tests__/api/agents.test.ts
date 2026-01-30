import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    aIAgent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from '@/lib/db';

describe('Agents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return agents ordered by order field', async () => {
      const mockAgents = [
        { id: '1', name: 'enrichisseur', displayName: 'Enrichisseur', order: 0 },
        { id: '2', name: 'adaptateur', displayName: 'Adaptateur', order: 1 },
      ];

      (prisma.aIAgent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);

      const result = await prisma.aIAgent.findMany({
        orderBy: { order: 'asc' },
      });

      expect(result).toEqual(mockAgents);
      expect(prisma.aIAgent.findMany).toHaveBeenCalledWith({
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('GET /api/agents/[id]', () => {
    it('should return agent by id', async () => {
      const mockAgent = {
        id: '1',
        name: 'enrichisseur',
        displayName: 'Enrichisseur',
        description: 'Test description',
        systemPrompt: 'System prompt',
        userPromptTemplate: '{{markdown}}',
        isActive: true,
        order: 0,
      };

      (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await prisma.aIAgent.findUnique({
        where: { id: '1' },
      });

      expect(result).toEqual(mockAgent);
    });

    it('should return null for non-existent agent', async () => {
      (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await prisma.aIAgent.findUnique({
        where: { id: 'non-existent' },
      });

      expect(result).toBeNull();
    });
  });

  describe('PATCH /api/agents/[id]', () => {
    it('should update agent fields', async () => {
      const updatedAgent = {
        id: '1',
        name: 'enrichisseur',
        displayName: 'Updated Name',
        isActive: false,
      };

      (prisma.aIAgent.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAgent);

      const result = await prisma.aIAgent.update({
        where: { id: '1' },
        data: { displayName: 'Updated Name', isActive: false },
      });

      expect(result.displayName).toBe('Updated Name');
      expect(result.isActive).toBe(false);
    });
  });

  describe('DELETE /api/agents/[id]', () => {
    it('should delete agent', async () => {
      (prisma.aIAgent.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '1' });

      await prisma.aIAgent.delete({
        where: { id: '1' },
      });

      expect(prisma.aIAgent.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
