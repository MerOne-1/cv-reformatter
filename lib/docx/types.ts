import { TextRun } from 'docx';

export interface ParsedSection {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'separator';
  content: string;
  items?: string[];
  metadata?: Record<string, string>;
}

export interface TemplateColors {
  primary: string;
  secondary: string;
  text: string;
  muted: string;
}

export type TextRunArray = TextRun[];
