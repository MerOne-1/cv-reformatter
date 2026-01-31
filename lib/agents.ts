import prisma from '@/lib/db';

interface AgentPrompts {
  system: string;
  user: string;
}

function escapeTemplateValue(value: string): string {
  return value.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}');
}

function processTemplate(template: string, markdown: string, context?: string): string {
  let result = template;

  const safeMarkdown = escapeTemplateValue(markdown);
  result = result.replace(/\{\{markdown\}\}/g, safeMarkdown);

  if (context) {
    const safeContext = escapeTemplateValue(context);
    result = result.replace(/\{\{#context\}\}([\s\S]*?)\{\{\/context\}\}/g, '$1');
    result = result.replace(/\{\{context\}\}/g, safeContext);
  } else {
    result = result.replace(/\{\{#context\}\}[\s\S]*?\{\{\/context\}\}/g, '');
    result = result.replace(/\{\{context\}\}/g, '');
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

export async function getAgentPrompts(
  agentType: string,
  markdown: string,
  context?: string
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
    user: processTemplate(agent.userPromptTemplate, markdown, context),
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
