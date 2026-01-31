import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    aIAgent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/db';
import { getAgentPrompts, getActiveAgents, AgentNotFoundError, AgentInactiveError } from '@/lib/agents';

describe('getAgentPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load prompts from database when agent exists and is active', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      displayName: 'Enrichisseur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#context}} Context: {{context}}{{/context}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', 'Mon CV', 'contexte test');

    expect(result.system).toBe('DB system prompt');
    expect(result.user).toBe('CV: Mon CV Context: contexte test');
  });

  it('should process template without context when not provided', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#context}} Context: {{context}}{{/context}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', 'Mon CV');

    expect(result.user).toBe('CV: Mon CV');
    expect(result.user).not.toContain('Context:');
  });

  it('should throw AgentNotFoundError when agent not in DB', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(getAgentPrompts('enrichisseur', 'Mon CV')).rejects.toThrow(AgentNotFoundError);
    await expect(getAgentPrompts('enrichisseur', 'Mon CV')).rejects.toThrow(
      'Agent "enrichisseur" non trouvé en base de données'
    );
  });

  it('should throw AgentInactiveError when agent is inactive', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'DB template',
      isActive: false,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    await expect(getAgentPrompts('enrichisseur', 'Mon CV')).rejects.toThrow(AgentInactiveError);
    await expect(getAgentPrompts('enrichisseur', 'Mon CV')).rejects.toThrow(
      'Agent "enrichisseur" est désactivé'
    );
  });

  it('should propagate database errors', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB connection failed')
    );

    await expect(getAgentPrompts('enrichisseur', 'Mon CV')).rejects.toThrow('DB connection failed');
  });
});

describe('getActiveAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return active agents ordered by order', async () => {
    const mockAgents = [
      { name: 'enrichisseur', displayName: 'Enrichisseur', description: 'Desc 1' },
      { name: 'adaptateur', displayName: 'Adaptateur', description: 'Desc 2' },
    ];

    (prisma.aIAgent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);

    const result = await getActiveAgents();

    expect(result).toEqual({ agents: mockAgents });
    expect(prisma.aIAgent.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        name: true,
        displayName: true,
        description: true,
      },
    });
  });

  it('should return empty array with error on failure', async () => {
    (prisma.aIAgent.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB error')
    );

    const result = await getActiveAgents();

    expect(result).toEqual({ agents: [], error: 'DB error' });
  });
});
