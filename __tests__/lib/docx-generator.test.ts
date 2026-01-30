import { describe, it, expect } from 'vitest';
import { generateDocx, getOutputFilename } from '@/lib/docx-generator';

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
