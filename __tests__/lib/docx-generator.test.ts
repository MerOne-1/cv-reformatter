import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDocx,
  getOutputFilename,
  generateDocxWithTemplate,
  getOutputFilenameFromTemplate,
} from '@/lib/docx-generator';
import { TemplateWithParsedConfig, parseTemplateConfig } from '@/lib/templates/types';

vi.mock('@/lib/templates/template-utils', () => ({
  loadLogoFromUrl: vi.fn().mockResolvedValue(null),
  getTemplateByName: vi.fn().mockResolvedValue(null),
  getTemplateById: vi.fn().mockResolvedValue(null),
}));

describe('getOutputFilename', () => {
  it('should generate correct filename for DreamIT', () => {
    const filename = getOutputFilename('Jean Dupont', 'DREAMIT');
    expect(filename).toMatch(/^CV_DreamIT_Jean_Dupont_\d{4}-\d{2}-\d{2}\.docx$/);
  });

  it('should generate correct filename for Rupturae', () => {
    const filename = getOutputFilename('Marie Martin', 'RUPTURAE');
    expect(filename).toMatch(/^CV_Rupturae_Marie_Martin_\d{4}-\d{2}-\d{2}\.docx$/);
  });

  it('should sanitize special characters in name', () => {
    const filename = getOutputFilename('José García', 'DREAMIT');
    expect(filename).toMatch(/^CV_DreamIT_Jose_Garcia_\d{4}-\d{2}-\d{2}\.docx$/);
  });
});

describe('generateDocx', () => {
  const sampleMarkdown = `# Jean Dupont

## Titre professionnel
Développeur Full-Stack Senior

## Résumé professionnel
Développeur passionné avec 5 ans d'expérience.

## Compétences techniques

### Langages
- JavaScript
- TypeScript
- Python

## Expériences professionnelles

### Développeur Senior | TechCorp
**Période:** Janvier 2020 - Présent
**Contexte:** Développement d'applications web

**Missions:**
- Développement de nouvelles fonctionnalités
- Code review et mentorat

**Technologies:** React, Node.js, PostgreSQL

---

### Développeur Junior | StartupXYZ
**Période:** Juin 2018 - Décembre 2019

## Formation

### Master Informatique | Université Paris
**Année:** 2018
`;

  it('should generate a valid DOCX buffer for DreamIT', async () => {
    const buffer = await generateDocx(sampleMarkdown, 'DREAMIT');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Check DOCX magic bytes (PK ZIP format)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it('should generate a valid DOCX buffer for Rupturae', async () => {
    const buffer = await generateDocx(sampleMarkdown, 'RUPTURAE');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle missing info markers', async () => {
    const markdownWithMissing = `# Test

##INFO MANQUANTE## [Dates de l'expérience]

## Compétences
- Test
`;

    const buffer = await generateDocx(markdownWithMissing, 'DREAMIT');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle empty content gracefully', async () => {
    const buffer = await generateDocx('', 'DREAMIT');
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('generateDocxWithTemplate', () => {
  const sampleMarkdown = `# Test Consultant

## Développeur Full-Stack

## Compétences
- JavaScript
- TypeScript
`;

  const createMockTemplate = (overrides: Partial<TemplateWithParsedConfig> = {}): TemplateWithParsedConfig => ({
    id: 'test-id',
    name: 'TEST',
    displayName: 'Test Template',
    primaryColor: '#1E3A8A',
    secondaryColor: '#3B82F6',
    textColor: '#1F2937',
    mutedColor: '#6B7280',
    logoUrl: null,
    logoHeaderUrl: null,
    logoFooterUrl: null,
    website: 'www.test.com',
    config: parseTemplateConfig('{}'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate DOCX with template config', async () => {
    const template = createMockTemplate({
      config: parseTemplateConfig(JSON.stringify({
        fonts: { family: 'Calibri', titleSize: 52 },
        margins: { top: 2000, bottom: 1500 },
      })),
    });

    const buffer = await generateDocxWithTemplate(sampleMarkdown, template);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0]).toBe(0x50); // P (ZIP)
    expect(buffer[1]).toBe(0x4b); // K (ZIP)
  });

  it('should use template colors', async () => {
    const template = createMockTemplate({
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
    });

    const buffer = await generateDocxWithTemplate(sampleMarkdown, template);

    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle template with website in footer', async () => {
    const template = createMockTemplate({
      website: 'www.example.com',
    });

    const buffer = await generateDocxWithTemplate(sampleMarkdown, template);

    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should apply pagination settings', async () => {
    const template = createMockTemplate({
      config: parseTemplateConfig(JSON.stringify({
        pagination: {
          keepWithNext: true,
          keepLines: true,
          widowControl: true,
        },
      })),
    });

    const buffer = await generateDocxWithTemplate(sampleMarkdown, template);

    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('getOutputFilenameFromTemplate', () => {
  const createMockTemplate = (): TemplateWithParsedConfig => ({
    id: 'test-id',
    name: 'CUSTOM',
    displayName: 'Custom Template',
    primaryColor: '#1E3A8A',
    secondaryColor: '#3B82F6',
    textColor: '#1F2937',
    mutedColor: '#6B7280',
    logoUrl: null,
    logoHeaderUrl: null,
    logoFooterUrl: null,
    website: null,
    config: parseTemplateConfig('{}'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should generate filename with template display name', () => {
    const template = createMockTemplate();
    const filename = getOutputFilenameFromTemplate('Jean Dupont', template);

    expect(filename).toMatch(/^CV_Custom Template_Jean_Dupont_\d{4}-\d{2}-\d{2}\.docx$/);
  });

  it('should sanitize consultant name', () => {
    const template = createMockTemplate();
    const filename = getOutputFilenameFromTemplate('José García', template);

    expect(filename).toMatch(/^CV_Custom Template_Jose_Garcia_\d{4}-\d{2}-\d{2}\.docx$/);
  });
});
