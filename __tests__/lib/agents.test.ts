import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    aIAgent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prompts', () => ({
  ENRICHISSEUR_SYSTEM_PROMPT: 'Static enrichisseur system prompt',
  ENRICHISSEUR_USER_PROMPT: (markdown: string, context?: string) =>
    `Static user prompt: ${markdown}${context ? ` - ${context}` : ''}`,
  ADAPTATEUR_SYSTEM_PROMPT: 'Static adaptateur system prompt',
  ADAPTATEUR_USER_PROMPT: (markdown: string, context: string) =>
    `Static adaptateur: ${markdown} - ${context}`,
  CONTEXTE_SYSTEM_PROMPT: 'Static contexte system prompt',
  CONTEXTE_USER_PROMPT: (markdown: string, context?: string) =>
    `Static contexte: ${markdown}`,
  BIO_SYSTEM_PROMPT: 'Static bio system prompt',
  BIO_USER_PROMPT: (markdown: string, tone?: string) =>
    `Static bio: ${markdown}`,
  EXTRACTION_SYSTEM_PROMPT: 'Static extraction system prompt',
  EXTRACTION_USER_PROMPT: (rawText: string) =>
    `Static extraction: ${rawText}`,
}));

import prisma from '@/lib/db';
import { getAgentPrompts, getActiveAgents } from '@/lib/agents';

describe('getAgentPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load prompts from database when agent exists', async () => {
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

  it('should fallback to static prompts when agent not in DB', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getAgentPrompts('enrichisseur', 'Mon CV');

    expect(result.system).toBe('Static enrichisseur system prompt');
    expect(result.user).toContain('Static user prompt: Mon CV');
  });

  it('should fallback to static prompts when agent is inactive', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'DB template',
      isActive: false,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', 'Mon CV');

    expect(result.system).toBe('Static enrichisseur system prompt');
  });

  it('should fallback to static prompts on database error', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB connection failed')
    );

    const result = await getAgentPrompts('enrichisseur', 'Mon CV');

    expect(result.system).toBe('Static enrichisseur system prompt');
  });

  it('should throw error for unknown agent type', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(getAgentPrompts('unknown-agent', 'Mon CV')).rejects.toThrow(
      'Unknown agent type: unknown-agent'
    );
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
