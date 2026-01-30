// Re-export everything from the modular implementation for backward compatibility
export {
  generateDocx,
  generateDocxWithTemplate,
  generateDocxByTemplateId,
  getOutputFilename,
  getOutputFilenameFromTemplate,
  parseMarkdown,
  formatText,
  getColorsFromTemplate,
  buildHeader,
  buildFooter,
  buildContent,
} from './docx';

export type { ParsedSection, TemplateColors } from './docx';
