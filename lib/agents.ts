import prisma from '@/lib/db';

interface AgentPrompts {
  system: string;
  user: string;
}

function escapeTemplateValue(value: string): string {
  return value.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}');
}

interface ProcessTemplateOptions {
  markdown: string;
  context?: string;
  pastMissionNotes?: string;
  futureMissionNotes?: string;
}

function processTemplate(template: string, options: ProcessTemplateOptions): string {
  let result = template;
  const { markdown, context, pastMissionNotes, futureMissionNotes } = options;

  // Remplacer {{markdown}}
  const safeMarkdown = escapeTemplateValue(markdown);
  result = result.replace(/\{\{markdown\}\}/g, safeMarkdown);

  // Traiter {{context}} (legacy)
  if (context) {
    const safeContext = escapeTemplateValue(context);
    result = result.replace(/\{\{#context\}\}([\s\S]*?)\{\{\/context\}\}/g, '$1');
    result = result.replace(/\{\{context\}\}/g, safeContext);
  } else {
    result = result.replace(/\{\{#context\}\}[\s\S]*?\{\{\/context\}\}/g, '');
    result = result.replace(/\{\{context\}\}/g, '');
  }

  // Traiter {{pastMissionNotes}}
  if (pastMissionNotes && pastMissionNotes.trim()) {
    const safePastNotes = escapeTemplateValue(pastMissionNotes);
    result = result.replace(/\{\{#pastMissionNotes\}\}([\s\S]*?)\{\{\/pastMissionNotes\}\}/g, '$1');
    result = result.replace(/\{\{pastMissionNotes\}\}/g, safePastNotes);
  } else {
    result = result.replace(/\{\{#pastMissionNotes\}\}[\s\S]*?\{\{\/pastMissionNotes\}\}/g, '');
    result = result.replace(/\{\{pastMissionNotes\}\}/g, '');
  }

  // Traiter {{futureMissionNotes}}
  if (futureMissionNotes && futureMissionNotes.trim()) {
    const safeFutureNotes = escapeTemplateValue(futureMissionNotes);
    result = result.replace(/\{\{#futureMissionNotes\}\}([\s\S]*?)\{\{\/futureMissionNotes\}\}/g, '$1');
    result = result.replace(/\{\{futureMissionNotes\}\}/g, safeFutureNotes);
  } else {
    result = result.replace(/\{\{#futureMissionNotes\}\}[\s\S]*?\{\{\/futureMissionNotes\}\}/g, '');
    result = result.replace(/\{\{futureMissionNotes\}\}/g, '');
  }

  return result;
}

export class AgentNotFoundError extends Error {
  constructor(agentType: string) {
    super(`Agent "${agentType}" non trouvé en base de données. Veuillez le configurer dans les paramètres.`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentInactiveError extends Error {
  constructor(agentType: string) {
    super(`Agent "${agentType}" est désactivé. Veuillez l'activer dans les paramètres.`);
    this.name = 'AgentInactiveError';
  }
}

export interface GetAgentPromptsOptions {
  markdown: string;
  context?: string;
  pastMissionNotes?: string;
  futureMissionNotes?: string;
}

export async function getAgentPrompts(
  agentType: string,
  options: GetAgentPromptsOptions
): Promise<AgentPrompts> {
  const agent = await prisma.aIAgent.findUnique({
    where: { name: agentType },
  });

  if (!agent) {
    throw new AgentNotFoundError(agentType);
  }

  if (!agent.isActive) {
    throw new AgentInactiveError(agentType);
  }

  if (!agent.systemPrompt || agent.systemPrompt.trim().length === 0) {
    throw new Error(`Agent "${agentType}" a un prompt système vide. Configurez-le dans les paramètres.`);
  }

  if (!agent.userPromptTemplate || agent.userPromptTemplate.trim().length === 0) {
    throw new Error(`Agent "${agentType}" a un template utilisateur vide. Configurez-le dans les paramètres.`);
  }

  return {
    system: agent.systemPrompt,
    user: processTemplate(agent.userPromptTemplate, options),
  };
}

export interface GetActiveAgentsResult {
  agents: Array<{
    name: string;
    displayName: string;
    description: string | null;
  }>;
  error?: string;
}

export async function getActiveAgents(): Promise<GetActiveAgentsResult> {
  try {
    const agents = await prisma.aIAgent.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        name: true,
        displayName: true,
        description: true,
      },
    });
    return { agents };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('Erreur lors de la récupération des agents actifs:', error);
    return { agents: [], error: errorMessage };
  }
}
