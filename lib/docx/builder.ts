import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ImageRun,
  Header,
  Footer,
  IImageOptions,
  PageNumber,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} from 'docx';
import { ParsedSection, TemplateColors } from './types';
import { TemplateConfig } from '../templates/types';
import { formatText } from './formatter';

export function buildHeader(
  logoBuffer: Buffer | null,
  config: TemplateConfig,
  colors: TemplateColors,
  brandName: string,
  initials?: string
): Header {
  // Header layout: Logo (left) | Initials (right)
  // Use a table for proper alignment
  const logoConfig = config.logos.header || { width: 120, height: 50 };

  const headerTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
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
                          width: logoConfig.width,
                          height: logoConfig.height,
                        },
                      }),
                    ],
                    alignment: AlignmentType.LEFT,
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
                    alignment: AlignmentType.LEFT,
                  }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            width: { size: 70, type: WidthType.PERCENTAGE },
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
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
    ],
  });

  return new Header({ children: [headerTable] });
}

export function buildFooter(
  _logoBuffer: Buffer | null,
  config: TemplateConfig,
  colors: TemplateColors,
  brandName: string,
  website?: string | null
): Footer {
  // Footer layout: Brand name (left) | Page X/Y (center) | Website (right)
  const footerTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [
      new TableRow({
        children: [
          // Left cell: Brand name
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: brandName,
                    size: config.fonts.smallSize,
                    color: colors.muted,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            width: { size: 33, type: WidthType.PERCENTAGE },
          }),
          // Center cell: Page number (X/Y format)
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
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            width: { size: 34, type: WidthType.PERCENTAGE },
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
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            width: { size: 33, type: WidthType.PERCENTAGE },
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
