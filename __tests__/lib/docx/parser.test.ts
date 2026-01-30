import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '@/lib/docx/parser';

describe('parseMarkdown', () => {
  it('should parse heading1', () => {
    const result = parseMarkdown('# Jean Dupont');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'heading1', content: 'Jean Dupont' });
  });

  it('should parse heading2', () => {
    const result = parseMarkdown('## Experience');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'heading2', content: 'Experience' });
  });

  it('should parse heading3', () => {
    const result = parseMarkdown('### Langages');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'heading3', content: 'Langages' });
  });

  it('should parse list items', () => {
    const markdown = `- JavaScript
- TypeScript
- Python`;
    const result = parseMarkdown(markdown);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('list');
    expect(result[0].items).toEqual(['JavaScript', 'TypeScript', 'Python']);
  });

  it('should parse list items with asterisks', () => {
    const markdown = `* Item 1
* Item 2`;
    const result = parseMarkdown(markdown);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('list');
    expect(result[0].items).toEqual(['Item 1', 'Item 2']);
  });

  it('should parse separator', () => {
    const result = parseMarkdown('---');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'separator', content: '' });
  });

  it('should parse paragraph', () => {
    const result = parseMarkdown('This is a simple paragraph.');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'paragraph', content: 'This is a simple paragraph.' });
  });

  it('should parse metadata from bold labels', () => {
    const result = parseMarkdown('**Projet:** Application web');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('paragraph');
    expect(result[0].metadata).toEqual({ 'Projet': 'Application web' });
  });

  it('should handle empty lines', () => {
    const markdown = `# Title

Paragraph after empty line`;
    const result = parseMarkdown(markdown);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('heading1');
    expect(result[1].type).toBe('paragraph');
  });

  it('should flush list before new section', () => {
    const markdown = `- Item 1
- Item 2

## New Section`;
    const result = parseMarkdown(markdown);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('list');
    expect(result[1].type).toBe('heading2');
  });

  it('should parse complete CV structure', () => {
    const markdown = `# Jean Dupont

## Experience

### 2020 - Present
- Led team of 5 developers
- Implemented CI/CD pipeline

---

## Skills
**Languages:** JavaScript, TypeScript`;

    const result = parseMarkdown(markdown);

    expect(result[0]).toEqual({ type: 'heading1', content: 'Jean Dupont' });
    expect(result[1]).toEqual({ type: 'heading2', content: 'Experience' });
    expect(result[2]).toEqual({ type: 'heading3', content: '2020 - Present' });
    expect(result[3].type).toBe('list');
    expect(result[3].items).toHaveLength(2);
    expect(result[4]).toEqual({ type: 'separator', content: '' });
    expect(result[5]).toEqual({ type: 'heading2', content: 'Skills' });
  });
});
