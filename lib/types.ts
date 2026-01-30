import {
  CV,
  Improvement,
  CVStatus,
  Brand,
  AIAgent,
  AgentConnection,
  WorkflowExecution,
  WorkflowStep,
  ExecutionStatus,
  StepStatus,
} from '@prisma/client';

export type {
  CV,
  Improvement,
  CVStatus,
  Brand,
  AIAgent,
  AgentConnection,
  WorkflowExecution,
  WorkflowStep,
  ExecutionStatus,
  StepStatus,
};

export interface CVWithImprovements extends CV {
  improvements: Improvement[];
}

export interface CVListItem {
  id: string;
  originalName: string;
  consultantName: string | null;
  title: string | null;
  status: CVStatus;
  brand: Brand;
  createdAt: Date;
  updatedAt: Date;
  hasMissingFields: boolean;
}

export interface ExtractedCV {
  consultantName: string;
  title: string;
  markdownContent: string;
  missingFields: string[];
}

export interface ImprovementRequest {
  cvId: string;
  agentType: 'enrichisseur' | 'adaptateur' | 'contexte' | 'bio';
  additionalContext?: string;
}

export interface AIAgentUpdate {
  displayName?: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  isActive?: boolean;
  order?: number;
}

export interface AIAgentWithConnections extends AIAgent {
  sourceConnections: (AgentConnection & { targetAgent: AIAgent })[];
  targetConnections: (AgentConnection & { sourceAgent: AIAgent })[];
}

export interface AgentGraphNode {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
  order: number;
  level: number;
  inputs: string[];
  outputs: string[];
}

export interface AgentGraph {
  nodes: AgentGraphNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    isActive: boolean;
  }>;
  isValid: boolean;
  validationErrors: string[];
}

export interface AgentConnectionCreate {
  sourceAgentId: string;
  targetAgentId: string;
  order?: number;
  isActive?: boolean;
}

export interface AgentConnectionUpdate {
  order?: number;
  isActive?: boolean;
}

export interface AgentJobData {
  executionId: string;
  stepId: string;
  agentId: string;
  cvId: string;
  inputData: Record<string, unknown>;
  markdownContent: string;
  additionalContext?: string;
}

export interface AgentJobResult {
  stepId: string;
  agentId: string;
  outputData: Record<string, unknown>;
  improvedMarkdown: string;
  success: boolean;
  error?: string;
}

export interface WorkflowConfig {
  cvId: string;
  additionalContext?: string;
  startAgentIds?: string[];
  timeoutMs?: number;
}

export interface WorkflowExecutionWithSteps extends WorkflowExecution {
  steps: (WorkflowStep & { agent: AIAgent })[];
  cv: CV;
}

export interface ImprovementResult {
  improvedContent: string;
  changes: string[];
}

export interface GenerateDocxRequest {
  cvId: string;
  brand: Brand;
}

export interface B2File {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// CV Markdown structure
export interface CVSection {
  title: string;
  content: string;
  order: number;
}

export const CV_SECTIONS = [
  'informations-personnelles',
  'resume-professionnel',
  'competences-techniques',
  'experiences-professionnelles',
  'formation',
  'certifications',
  'langues',
  'centres-interet',
] as const;

export type CVSectionType = (typeof CV_SECTIONS)[number];

// Missing info marker (legacy)
export const MISSING_INFO_MARKER = '##INFO MANQUANTE##';

export function detectMissingFields(markdown: string): string[] {
  const missingFields: string[] = [];

  // New format: detect items in the blockquote at the top
  // > **Informations à compléter :**
  // > - [Info 1]
  const blockquoteRegex = /^>\s*-\s*(.+)$/gm;
  let match;
  while ((match = blockquoteRegex.exec(markdown)) !== null) {
    const field = match[1].trim();
    if (field && !field.startsWith('**')) {
      missingFields.push(field);
    }
  }

  // Legacy format: ##INFO MANQUANTE## [xxx]
  const legacyRegex = new RegExp(`${MISSING_INFO_MARKER}\\s*\\[([^\\]]+)\\]`, 'g');
  while ((match = legacyRegex.exec(markdown)) !== null) {
    missingFields.push(match[1]);
  }

  // Also detect [À compléter] placeholders
  const placeholderRegex = /\[À compléter\]/gi;
  const placeholderCount = (markdown.match(placeholderRegex) || []).length;
  if (placeholderCount > 0 && missingFields.length === 0) {
    missingFields.push(`${placeholderCount} champ(s) à compléter`);
  }

  return Array.from(new Set(missingFields));
}

export function extractConsultantNameFromFilename(filename: string): string | null {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(pdf|docx|doc)$/i, '');

  // Try to extract name (common patterns: CV_Prenom_Nom, Prenom-Nom_CV, etc.)
  const patterns = [
    /^CV[_-]?(.+)/i,
    /(.+)[_-]?CV$/i,
    /^(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return match[1]
        .replace(/[_-]/g, ' ')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}
