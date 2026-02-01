import {
  CV,
  Improvement,
  CVStatus,
  AIAgent,
  AgentConnection,
  WorkflowExecution,
  WorkflowStep,
  ExecutionStatus,
  StepStatus,
  Comment,
  User,
} from '@prisma/client';

export type {
  CV,
  Improvement,
  CVStatus,
  AIAgent,
  AgentConnection,
  WorkflowExecution,
  WorkflowStep,
  ExecutionStatus,
  StepStatus,
  Comment,
  User,
};

// Type pour le nom de template (remplace l'ancien enum Brand)
export type TemplateName = string;

export interface CVWithImprovements extends CV {
  improvements: Improvement[];
}

export interface CVListItem {
  id: string;
  originalName: string;
  consultantName: string | null;
  title: string | null;
  status: CVStatus;
  templateName: string;
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

export interface CollaborativeUser {
  id: string;
  name: string;
  color: string;
  persistedColor?: string;
}

export interface UserPreferences {
  highlightColor: string;
}

export interface CommentWithUser extends Comment {
  user: {
    id: string;
    name: string;
    highlightColor: string;
  };
}

export interface CommentCreate {
  content: string;
  cvId: string;
  startOffset: number;
  endOffset: number;
}

export interface CommentUpdate {
  content?: string;
  resolved?: boolean;
  resolvedBy?: string;
}

export interface WebSocketConfig {
  url: string;
  documentId: string;
  userId: string;
  userName: string;
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
  positionX?: number | null;
  positionY?: number | null;
}

export interface NodePositionUpdate {
  agentId: string;
  x: number;
  y: number;
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
  templateName: string;
}

export interface B2File {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

// Discriminated union pour APIResponse - garantit la cohérence success/data/error
export type APIResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

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

// Note: extractConsultantNameFromFilename est défini dans lib/utils.ts
// Importer depuis utils.ts si nécessaire
