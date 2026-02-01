import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  TableLayoutType,
} from 'docx';
import { ParsedSection, TemplateColors } from './types';
import { TemplateConfig } from '../templates/types';
import { formatText } from './formatter';

// Convert twips to points (1 inch = 1440 twips = 72 points)
function twipsToPoints(twips: number): number {
  return Math.round(twips / 20);
}

// Extract image dimensions from buffer (supports PNG and JPEG)
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length < 24) return null;

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // Check JPEG signature: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      // JPEG dimensions are in SOF0/SOF2 segment
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xFF) {
          offset++;
          continue;
        }

        const marker = buffer[offset + 1];

        // SOF0 (0xC0) or SOF2 (0xC2) contain dimensions
        if (marker === 0xC0 || marker === 0xC2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }

        // Skip to next segment
        if (marker >= 0xC0 && marker <= 0xFE && marker !== 0xD8 && marker !== 0xD9) {
          const segmentLength = buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        } else {
          offset += 2;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Calculate logo dimensions preserving aspect ratio
function calculateLogoDimensions(
  buffer: Buffer,
  targetHeight: number
): { width: number; height: number } {
  const dimensions = getImageDimensions(buffer);

  if (dimensions && dimensions.height > 0) {
    const aspectRatio = dimensions.width / dimensions.height;
    return {
      width: Math.round(targetHeight * aspectRatio),
      height: targetHeight,
    };
  }

  // Fallback: assume 2.5:1 aspect ratio (typical logo ratio)
  return {
    width: Math.round(targetHeight * 2.5),
    height: targetHeight,
  };
}

// A4 page width in twips: 210mm = 11906 twips
// Default margins: 1080 twips each side
// Available width for content: 11906 - 1080 - 1080 = 9746 twips
const DEFAULT_CONTENT_WIDTH = 9746;

// No borders helper
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

export function buildHeader(
  logoBuffer: Buffer | null,
  config: TemplateConfig,
  colors: TemplateColors,
  brandName: string,
  initials?: string
): Header {
  // Header layout: Logo/brand name (left) | Initials (right)
  // Use table with fixed column widths for Google Docs compatibility

  // Calculate logo dimensions preserving aspect ratio from actual image
  // PDF uses height: 55 with objectFit: 'contain'
  const headerLogoHeight = 55;
  const logoDimensions = logoBuffer
    ? calculateLogoDimensions(logoBuffer, headerLogoHeight)
    : { width: 140, height: headerLogoHeight };

  // Column widths: 70% left, 30% right
  const leftWidth = Math.round(DEFAULT_CONTENT_WIDTH * 0.70);
  const rightWidth = Math.round(DEFAULT_CONTENT_WIDTH * 0.30);

  const headerTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: DEFAULT_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [leftWidth, rightWidth],
    rows: [
      new TableRow({
        children: [
          // Left cell: Logo or brand name
          new TableCell({
            children: [
              logoBuffer
                ? new Paragraph({
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: logoBuffer,
                        transformation: {
                          width: logoDimensions.width,
                          height: logoDimensions.height,
                        },
                      }),
                    ],
                  })
                : new Paragraph({
                    children: [
                      new TextRun({
                        text: brandName,
                        bold: true,
                        color: colors.primary,
                        size: 28,
                      }),
                    ],
                  }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: NO_BORDERS,
            width: { size: leftWidth, type: WidthType.DXA },
          }),
          // Right cell: Initials
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: initials || '',
                    bold: true,
                    color: colors.primary,
                    size: 24,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: NO_BORDERS,
            width: { size: rightWidth, type: WidthType.DXA },
          }),
        ],
      }),
    ],
  });

  return new Header({ children: [headerTable] });
}

export function buildFooter(
  logoBuffer: Buffer | null,
  config: TemplateConfig,
  colors: TemplateColors,
  brandName: string,
  website?: string | null
): Footer {
  // Footer layout: Logo/Brand name (left) | Page X/Y (center) | Website (right)
  // Use table with fixed column widths for Google Docs compatibility

  // Calculate logo dimensions preserving aspect ratio from actual image
  const footerLogoHeight = 20; // Target height in points (similar to PDF)
  const footerLogoDimensions = logoBuffer
    ? calculateLogoDimensions(logoBuffer, footerLogoHeight)
    : { width: 60, height: footerLogoHeight };

  // Column widths: 40% left, 20% center, 40% right
  const leftWidth = Math.round(DEFAULT_CONTENT_WIDTH * 0.40);
  const centerWidth = Math.round(DEFAULT_CONTENT_WIDTH * 0.20);
  const rightWidth = Math.round(DEFAULT_CONTENT_WIDTH * 0.40);

  const footerTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: DEFAULT_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [leftWidth, centerWidth, rightWidth],
    rows: [
      new TableRow({
        children: [
          // Left cell: Logo or brand name
          new TableCell({
            children: [
              logoBuffer
                ? new Paragraph({
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: logoBuffer,
                        transformation: {
                          width: footerLogoDimensions.width,
                          height: footerLogoDimensions.height,
                        },
                      }),
                    ],
                  })
                : new Paragraph({
                    children: [
                      new TextRun({
                        text: brandName,
                        size: config.fonts.smallSize,
                        color: colors.muted,
                      }),
                    ],
                  }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: NO_BORDERS,
            width: { size: leftWidth, type: WidthType.DXA },
          }),
          // Center cell: Page number
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: config.fonts.smallSize,
                    color: colors.muted,
                  }),
                  new TextRun({
                    text: '/',
                    size: config.fonts.smallSize,
                    color: colors.muted,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: config.fonts.smallSize,
                    color: colors.muted,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: NO_BORDERS,
            width: { size: centerWidth, type: WidthType.DXA },
          }),
          // Right cell: Website
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: website || '',
                    size: config.fonts.smallSize,
                    color: colors.muted,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: NO_BORDERS,
            width: { size: rightWidth, type: WidthType.DXA },
          }),
        ],
      }),
    ],
  });

  return new Footer({ children: [footerTable] });
}

export function buildContent(
  sections: ParsedSection[],
  config: TemplateConfig,
  colors: TemplateColors
): Paragraph[] {
  const children: Paragraph[] = [];

  for (const section of sections) {
    switch (section.type) {
      case 'heading1':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.content,
                bold: true,
                size: config.fonts.titleSize,
                color: colors.primary,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: config.spacing.afterTitle },
            alignment: AlignmentType.CENTER,
            keepNext: config.pagination.keepWithNext,
            keepLines: config.pagination.keepLines,
          })
        );
        break;

      case 'heading2':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: config.styles.heading2Uppercase
                  ? section.content.toUpperCase()
                  : section.content,
                bold: true,
                size: config.fonts.heading2Size,
                color: colors.primary,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: config.spacing.beforeSection, after: config.spacing.afterHeading2 },
            border: config.styles.heading2Border ? {
              bottom: {
                color: colors.secondary,
                size: 12,
                style: BorderStyle.SINGLE,
              },
            } : undefined,
            keepNext: config.pagination.keepWithNext,
            keepLines: config.pagination.keepLines,
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
                size: config.fonts.heading3Size,
                color: colors.secondary,
              }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: config.spacing.afterHeading3 },
            keepNext: config.pagination.keepWithNext,
            keepLines: config.pagination.keepLines,
          })
        );
        break;

      case 'list':
        for (const item of section.items || []) {
          children.push(
            new Paragraph({
              children: formatText(item, colors.text),
              bullet: { level: 0 },
              spacing: { before: 50, after: config.spacing.afterListItem },
              keepLines: config.pagination.keepLines,
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
            children: formatText(section.content, colors.text),
            spacing: { before: 100, after: config.spacing.afterParagraph },
            keepLines: config.pagination.keepLines,
          })
        );
        break;
    }
  }

  return children;
}
