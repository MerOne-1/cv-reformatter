import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  Packer,
} from 'docx';
import {
  TemplateWithParsedConfig,
  parseTemplateConfig,
} from '../templates/types';
import { loadLogoFromUrl, getTemplateByName } from '../templates/template-utils';
import { parseMarkdown } from './parser';
import { formatText, getColorsFromTemplate } from './formatter';
import { buildHeader, buildFooter, buildContent } from './builder';
import { getInitials } from '../utils';

// Legacy brand type for backward compatibility
type LegacyBrand = 'DREAMIT' | 'RUPTURAE';

const BRAND_COLORS: Record<LegacyBrand, { primary: string; secondary: string; text: string; muted: string }> = {
  DREAMIT: { primary: '0C4A6E', secondary: '0EA5E9', text: '1F2937', muted: '6B7280' },
  RUPTURAE: { primary: '7C3AED', secondary: 'A78BFA', text: '1F2937', muted: '6B7280' },
};

export async function generateDocxWithTemplate(
  markdown: string,
  template: TemplateWithParsedConfig
): Promise<Buffer> {
  const config = template.config;
  const colors = getColorsFromTemplate(template);
  const sections = parseMarkdown(markdown);

  let consultantName = 'Consultant';
  const firstHeading = sections.find(s => s.type === 'heading1');
  if (firstHeading) {
    consultantName = firstHeading.content;
  }

  // Extract initials from consultant name (e.g., "Jean Dupont" -> "JD")
  const initials = getInitials(consultantName);

  // Use logoUrl as the main logo (for both header and footer if needed)
  // Fall back to logoHeaderUrl/logoFooterUrl for backward compatibility
  const mainLogoUrl = template.logoUrl || template.logoHeaderUrl;
  const logo = await loadLogoFromUrl(mainLogoUrl);

  if (mainLogoUrl && !logo) {
    console.warn(`Logo configured but failed to load: ${mainLogoUrl}`);
  }

  const children = buildContent(sections, config, colors);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: config.fonts.family,
            size: config.fonts.bodySize,
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: config.margins.top,
              right: config.margins.right,
              bottom: config.margins.bottom,
              left: config.margins.left,
            },
          },
        },
        headers: {
          default: buildHeader(logo, config, colors, template.displayName, initials),
        },
        footers: {
          default: buildFooter(logo, config, colors, template.displayName, template.website),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function generateDocxByTemplateId(
  markdown: string,
  templateId: string
): Promise<Buffer> {
  const { getTemplateById } = await import('../templates/template-utils');
  const template = await getTemplateById(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return generateDocxWithTemplate(markdown, template);
}

export async function generateDocx(markdown: string, brand: LegacyBrand): Promise<Buffer> {
  const template = await getTemplateByName(brand);

  if (template) {
    return generateDocxWithTemplate(markdown, template);
  }

  console.warn(`Template ${brand} not found in database, using fallback colors`);

  const colors = BRAND_COLORS[brand];
  const sections = parseMarkdown(markdown);
  const children: Paragraph[] = [];

  let consultantName = 'Consultant';
  const firstHeading = sections.find(s => s.type === 'heading1');
  if (firstHeading) {
    consultantName = firstHeading.content;
  }

  for (const section of sections) {
    switch (section.type) {
      case 'heading1':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                bold: true,
                size: 48,
                color: colors.primary,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            alignment: AlignmentType.CENTER,
            keepNext: true,
          })
        );
        break;

      case 'heading2':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content.toUpperCase(),
                bold: true,
                size: 28,
                color: colors.primary,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            border: {
              bottom: {
                color: colors.secondary,
                size: 12,
                style: BorderStyle.SINGLE,
              },
            },
            keepNext: true,
          })
        );
        break;

      case 'heading3':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                bold: true,
                size: 24,
                color: colors.secondary,
              }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
            keepNext: true,
          })
        );
        break;

      case 'list':
        for (const item of section.items || []) {
          children.push(
            new Paragraph({
              children: formatText(item),
              bullet: { level: 0 },
              spacing: { before: 50, after: 50 },
            })
          );
        }
        break;

      case 'separator':
        children.push(
          new Paragraph({
            children: [],
            spacing: { before: 100, after: 100 },
            border: {
              bottom: {
                color: 'CCCCCC',
                size: 6,
                style: BorderStyle.SINGLE,
              },
            },
          })
        );
        break;

      case 'paragraph':
        children.push(
          new Paragraph({
            children: formatText(section.content),
            spacing: { before: 100, after: 100 },
          })
        );
        break;
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: brand === 'DREAMIT' ? 'DreamIT' : 'Rupturae',
                    bold: true,
                    color: colors.primary,
                    size: 20,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `CV - ${consultantName}`,
                    size: 18,
                    color: '666666',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export function getOutputFilename(consultantName: string, brand: LegacyBrand): string {
  const initials = getInitials(consultantName);
  const brandPrefix = brand === 'DREAMIT' ? 'DreamIT' : 'Rupturae';
  const date = new Date().toISOString().slice(0, 10);

  return `CV_${brandPrefix}_${initials}_${date}.docx`;
}

export function getOutputFilenameFromTemplate(consultantName: string, template: TemplateWithParsedConfig): string {
  const initials = getInitials(consultantName);
  const date = new Date().toISOString().slice(0, 10);

  return `CV_${template.displayName}_${initials}_${date}.docx`;
}
