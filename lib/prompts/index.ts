export { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from './extraction';
export { ENRICHISSEUR_SYSTEM_PROMPT, ENRICHISSEUR_USER_PROMPT } from './enrichisseur';
export { ADAPTATEUR_SYSTEM_PROMPT, ADAPTATEUR_USER_PROMPT } from './adaptateur';
export { CONTEXTE_SYSTEM_PROMPT, CONTEXTE_USER_PROMPT } from './contexte';
export { BIO_SYSTEM_PROMPT, BIO_USER_PROMPT } from './bio';

export const AGENT_TYPES = ['enrichisseur', 'adaptateur', 'contexte', 'bio'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_DESCRIPTIONS: Record<AgentType, { name: string; description: string }> = {
  enrichisseur: {
    name: 'Enrichisseur',
    description: 'Améliore les descriptions et valorise les compétences sans inventer',
  },
  adaptateur: {
    name: 'Adaptateur',
    description: 'Réorganise le CV pour une mission ou un poste spécifique',
  },
  contexte: {
    name: 'Contextualiseur',
    description: 'Ajoute du contexte métier et business aux expériences',
  },
  bio: {
    name: 'Bio Writer',
    description: 'Crée ou améliore le résumé professionnel',
  },
};
