// Public API - main exports
export {
  generateDocx,
  generateDocxWithTemplate,
  generateDocxByTemplateId,
  getOutputFilename,
  getOutputFilenameFromTemplate,
} from './generator';

// Types
export type { ParsedSection, TemplateColors } from './types';

// Utilities for advanced usage
export { parseMarkdown } from './parser';
export { formatText, getColorsFromTemplate } from './formatter';
export { buildHeader, buildFooter, buildContent } from './builder';
