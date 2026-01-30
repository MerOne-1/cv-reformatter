import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectMissingFields, MISSING_INFO_MARKER } from '@/lib/types';

// Mock the external dependencies
vi.mock('@/lib/db', () => ({
  default: {
    cV: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/b2', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  askLLM: vi.fn(),
}));

describe('detectMissingFields', () => {
  it('should detect missing fields from markers', () => {
    const markdown = `# Jean Dupont

## Expériences

### Développeur | Company
**Période:** ${MISSING_INFO_MARKER} [Dates de l'expérience]
**Contexte:** ${MISSING_INFO_MARKER} [Description du contexte]
`;

    const fields = detectMissingFields(markdown);

    expect(fields).toHaveLength(2);
    expect(fields).toContain("Dates de l'expérience");
    expect(fields).toContain('Description du contexte');
  });

  it('should return empty array when no missing fields', () => {
    const markdown = `# Jean Dupont

## Expériences

### Développeur | Company
**Période:** Janvier 2020 - Présent
`;

    const fields = detectMissingFields(markdown);
    expect(fields).toHaveLength(0);
  });

  it('should deduplicate repeated missing fields', () => {
    const markdown = `
${MISSING_INFO_MARKER} [Email]
${MISSING_INFO_MARKER} [Email]
${MISSING_INFO_MARKER} [Téléphone]
`;

    const fields = detectMissingFields(markdown);

    expect(fields).toHaveLength(2);
    expect(fields).toContain('Email');
    expect(fields).toContain('Téléphone');
  });
});

describe('CV extraction API logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract consultant name from markdown H1', () => {
    const markdown = '# Pierre Martin\n\n## Titre\nDéveloppeur';
    const match = markdown.match(/^#\s+(.+)$/m);

    expect(match).not.toBeNull();
    expect(match![1]).toBe('Pierre Martin');
  });

  it('should extract title from markdown', () => {
    const markdown = `# Test

## Titre professionnel
Architecte Cloud Senior

## Compétences
`;
    const match = markdown.match(/##\s+Titre professionnel\s*\n+(.+)/);

    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('Architecte Cloud Senior');
  });
});
