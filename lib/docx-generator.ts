import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  Header,
  Footer,
  Packer,
} from 'docx';
import { Brand } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Brand colors
const BRAND_COLORS: Record<Brand, { primary: string; secondary: string }> = {
  DREAMIT: { primary: '1E3A8A', secondary: '3B82F6' },
  RUPTURAE: { primary: '7C3AED', secondary: 'A78BFA' },
};

interface ParsedSection {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'separator';
  content: string;
  items?: string[];
  metadata?: Record<string, string>;
}

function parseMarkdown(markdown: string): ParsedSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      sections.push({ type: 'list', content: '', items: [...currentList] });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      continue;
    }

    if (trimmed === '---') {
      flushList();
      sections.push({ type: 'separator', content: '' });
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      flushList();
      sections.push({ type: 'heading1', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('## ')) {
      flushList();
      sections.push({ type: 'heading2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('### ')) {
      flushList();
      sections.push({ type: 'heading3', content: trimmed.slice(4) });
    }
    // List items
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
    }
    // Bold/metadata lines (like **Période:** ...)
    else if (trimmed.startsWith('**') && trimmed.includes(':**')) {
      flushList();
      const match = trimmed.match(/\*\*([^*]+):\*\*\s*(.+)/);
      if (match) {
        sections.push({
          type: 'paragraph',
          content: trimmed,
          metadata: { [match[1]]: match[2] },
        });
      } else {
        sections.push({ type: 'paragraph', content: trimmed });
      }
    }
    // Regular paragraph
    else {
      flushList();
      sections.push({ type: 'paragraph', content: trimmed });
    }
  }

  flushList();
  return sections;
}

function formatText(text: string, color?: string): TextRun[] {
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
      // Handle ##INFO MANQUANTE## markers
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

export async function generateDocx(markdown: string, brand: Brand): Promise<Buffer> {
  const colors = BRAND_COLORS[brand];
  const sections = parseMarkdown(markdown);
  const children: Paragraph[] = [];

  // Extract consultant name from first heading
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

export function getOutputFilename(consultantName: string, brand: Brand): string {
  const sanitized = consultantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();

  const brandPrefix = brand === 'DREAMIT' ? 'DreamIT' : 'Rupturae';
  const date = new Date().toISOString().slice(0, 10);

  return `CV_${brandPrefix}_${sanitized}_${date}.docx`;
}
