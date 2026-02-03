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

    const result = await getAgentPrompts('enrichisseur', { markdown: 'Mon CV', context: 'contexte test' });

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

    const result = await getAgentPrompts('enrichisseur', { markdown: 'Mon CV' });

    expect(result.user).toBe('CV: Mon CV');
    expect(result.user).not.toContain('Context:');
  });

  it('should process template with pastMissionNotes', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#pastMissionNotes}} Notes: {{pastMissionNotes}}{{/pastMissionNotes}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', { markdown: 'Mon CV', pastMissionNotes: 'Equipe de 5' });

    expect(result.user).toBe('CV: Mon CV Notes: Equipe de 5');
  });

  it('should process template with futureMissionNotes', async () => {
    const mockAgent = {
      id: '1',
      name: 'adaptateur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#futureMissionNotes}} Poste: {{futureMissionNotes}}{{/futureMissionNotes}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('adaptateur', { markdown: 'Mon CV', futureMissionNotes: 'Tech Lead React' });

    expect(result.user).toBe('CV: Mon CV Poste: Tech Lead React');
  });

  it('should remove conditional blocks when notes are empty', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'DB system prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#pastMissionNotes}} Notes: {{pastMissionNotes}}{{/pastMissionNotes}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', { markdown: 'Mon CV', pastMissionNotes: '' });

    expect(result.user).toBe('CV: Mon CV');
    expect(result.user).not.toContain('Notes:');
  });

  it('should throw AgentNotFoundError when agent not in DB', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(AgentNotFoundError);
    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(
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

    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(AgentInactiveError);
    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(
      'Agent "enrichisseur" est désactivé'
    );
  });

  it('should propagate database errors', async () => {
    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB connection failed')
    );

    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow('DB connection failed');
  });

  it('should throw error when system prompt is empty', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: '',
      userPromptTemplate: 'CV: {{markdown}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(
      'Agent "enrichisseur" a un prompt système vide'
    );
  });

  it('should throw error when system prompt is whitespace only', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: '   ',
      userPromptTemplate: 'CV: {{markdown}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(
      'Agent "enrichisseur" a un prompt système vide'
    );
  });

  it('should throw error when user prompt template is empty', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'System prompt',
      userPromptTemplate: '',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    await expect(getAgentPrompts('enrichisseur', { markdown: 'Mon CV' })).rejects.toThrow(
      'Agent "enrichisseur" a un template utilisateur vide'
    );
  });

  it('should escape template injection attempts in markdown', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'System prompt',
      userPromptTemplate: 'CV: {{markdown}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    // Attempt to inject template syntax
    const result = await getAgentPrompts('enrichisseur', {
      markdown: 'Malicious {{#context}}injected{{/context}} content',
    });

    // The curly braces should be escaped
    expect(result.user).toContain('\\{\\{#context\\}\\}');
    expect(result.user).not.toContain('{{#context}}');
  });

  it('should escape template injection attempts in notes', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'System prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#pastMissionNotes}} Notes: {{pastMissionNotes}}{{/pastMissionNotes}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', {
      markdown: 'Mon CV',
      pastMissionNotes: 'Notes with {{futureMissionNotes}} injection attempt',
    });

    // The injection attempt should be escaped
    expect(result.user).toContain('\\{\\{futureMissionNotes\\}\\}');
  });

  it('should handle all notes fields together', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'System prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#context}} Ctx: {{context}}{{/context}}{{#pastMissionNotes}} Past: {{pastMissionNotes}}{{/pastMissionNotes}}{{#futureMissionNotes}} Future: {{futureMissionNotes}}{{/futureMissionNotes}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', {
      markdown: 'Mon CV',
      context: 'Legacy context',
      pastMissionNotes: 'Past notes',
      futureMissionNotes: 'Future notes',
    });

    expect(result.user).toBe('CV: Mon CV Ctx: Legacy context Past: Past notes Future: Future notes');
  });

  it('should handle whitespace-only notes as empty', async () => {
    const mockAgent = {
      id: '1',
      name: 'enrichisseur',
      systemPrompt: 'System prompt',
      userPromptTemplate: 'CV: {{markdown}}{{#pastMissionNotes}} Past: {{pastMissionNotes}}{{/pastMissionNotes}}{{#futureMissionNotes}} Future: {{futureMissionNotes}}{{/futureMissionNotes}}',
      isActive: true,
    };

    (prisma.aIAgent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

    const result = await getAgentPrompts('enrichisseur', {
      markdown: 'Mon CV',
      pastMissionNotes: '   ',
      futureMissionNotes: '\n\t',
    });

    expect(result.user).toBe('CV: Mon CV');
    expect(result.user).not.toContain('Past:');
    expect(result.user).not.toContain('Future:');
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
