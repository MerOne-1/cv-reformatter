import prisma from '@/lib/db';
import {
  ENRICHISSEUR_SYSTEM_PROMPT,
  ENRICHISSEUR_USER_PROMPT,
  ADAPTATEUR_SYSTEM_PROMPT,
  ADAPTATEUR_USER_PROMPT,
  CONTEXTE_SYSTEM_PROMPT,
  CONTEXTE_USER_PROMPT,
  BIO_SYSTEM_PROMPT,
  BIO_USER_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
} from '@/lib/prompts';

interface AgentPrompts {
  system: string;
  user: string;
}

function processTemplate(template: string, markdown: string, context?: string): string {
  let result = template;

  result = result.replace(/\{\{markdown\}\}/g, markdown);

  if (context) {
    result = result.replace(/\{\{#context\}\}([\s\S]*?)\{\{\/context\}\}/g, '$1');
    result = result.replace(/\{\{context\}\}/g, context);
  } else {
    result = result.replace(/\{\{#context\}\}[\s\S]*?\{\{\/context\}\}/g, '');
    result = result.replace(/\{\{context\}\}/g, '');
  }

  return result;
}

function getStaticPrompts(agentType: string, markdown: string, context?: string): AgentPrompts {
  switch (agentType) {
    case 'enrichisseur':
      return {
        system: ENRICHISSEUR_SYSTEM_PROMPT,
        user: ENRICHISSEUR_USER_PROMPT(markdown, context),
      };
    case 'adaptateur':
      return {
        system: ADAPTATEUR_SYSTEM_PROMPT,
        user: ADAPTATEUR_USER_PROMPT(markdown, context || 'Amélioration générale du CV'),
      };
    case 'contexte':
      return {
        system: CONTEXTE_SYSTEM_PROMPT,
        user: CONTEXTE_USER_PROMPT(markdown, context),
      };
    case 'bio':
      return {
        system: BIO_SYSTEM_PROMPT,
        user: BIO_USER_PROMPT(markdown, context),
      };
    case 'extraction':
      return {
        system: EXTRACTION_SYSTEM_PROMPT,
        user: EXTRACTION_USER_PROMPT(markdown),
      };
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

export async function getAgentPrompts(
  agentType: string,
  markdown: string,
  context?: string
): Promise<AgentPrompts> {
  try {
    const agent = await prisma.aIAgent.findUnique({
      where: { name: agentType },
    });

    if (agent && agent.isActive) {
      return {
        system: agent.systemPrompt,
        user: processTemplate(agent.userPromptTemplate, markdown, context),
      };
    }

    console.warn(`Agent ${agentType} not found in DB or inactive, using static prompts`);
    return getStaticPrompts(agentType, markdown, context);
  } catch (error) {
    console.error(`Error fetching agent ${agentType} from DB:`, error);
    return getStaticPrompts(agentType, markdown, context);
  }
}

export async function getActiveAgents() {
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
    return agents;
  } catch (error) {
    console.error('Error fetching active agents:', error);
    return [];
  }
}
