import { TextRun } from 'docx';
import { TemplateColors } from './types';
import { TemplateWithParsedConfig } from '../templates/types';

export function formatText(text: string, color?: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          color: color,
        })
      );
    } else if (part) {
      if (part.includes('##INFO MANQUANTE##')) {
        const subParts = part.split(/(##INFO MANQUANTE##\s*\[[^\]]+\])/g);
        for (const subPart of subParts) {
          if (subPart.startsWith('##INFO MANQUANTE##')) {
            runs.push(
              new TextRun({
                text: subPart,
                color: 'FF0000',
                highlight: 'yellow',
              })
            );
          } else if (subPart) {
            runs.push(new TextRun({ text: subPart, color }));
          }
        }
      } else {
        runs.push(new TextRun({ text: part, color }));
      }
    }
  }

  return runs;
}

export function getColorsFromTemplate(template: TemplateWithParsedConfig): TemplateColors {
  return {
    primary: template.primaryColor.replace('#', ''),
    secondary: template.secondaryColor.replace('#', ''),
    text: template.textColor.replace('#', ''),
    muted: template.mutedColor.replace('#', ''),
  };
}
