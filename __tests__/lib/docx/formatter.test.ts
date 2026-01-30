import { describe, it, expect } from 'vitest';
import { formatText, getColorsFromTemplate } from '@/lib/docx/formatter';
import { TemplateWithParsedConfig, parseTemplateConfig } from '@/lib/templates/types';

describe('formatText', () => {
  it('should return TextRuns for plain text', () => {
    const runs = formatText('Hello World');
    expect(runs.length).toBeGreaterThan(0);
  });

  it('should handle bold text and return multiple runs', () => {
    const runs = formatText('This is **bold** text');
    expect(runs.length).toBeGreaterThanOrEqual(3);
  });

  it('should return runs when color is provided', () => {
    const runs = formatText('Colored text', 'FF0000');
    expect(runs.length).toBeGreaterThan(0);
  });

  it('should handle missing info markers', () => {
    const runs = formatText('Name: ##INFO MANQUANTE## [à compléter]');
    expect(runs.length).toBeGreaterThan(0);
  });

  it('should handle multiple bold sections', () => {
    const runs = formatText('**First** and **Second**');
    expect(runs.length).toBeGreaterThanOrEqual(3);
  });

  it('should return empty array for empty string', () => {
    const runs = formatText('');
    expect(runs).toHaveLength(0);
  });
});

describe('getColorsFromTemplate', () => {
  it('should extract colors without hash', () => {
    const template = {
      id: '1',
      name: 'test',
      displayName: 'Test',
      primaryColor: '#0C4A6E',
      secondaryColor: '#0EA5E9',
      textColor: '#1F2937',
      mutedColor: '#6B7280',
      config: parseTemplateConfig(null),
    } as TemplateWithParsedConfig;

    const colors = getColorsFromTemplate(template);

    expect(colors.primary).toBe('0C4A6E');
    expect(colors.secondary).toBe('0EA5E9');
    expect(colors.text).toBe('1F2937');
    expect(colors.muted).toBe('6B7280');
  });

  it('should handle colors without hash prefix', () => {
    const template = {
      id: '1',
      name: 'test',
      displayName: 'Test',
      primaryColor: 'AABBCC',
      secondaryColor: 'DDEEFF',
      textColor: '112233',
      mutedColor: '445566',
      config: parseTemplateConfig(null),
    } as TemplateWithParsedConfig;

    const colors = getColorsFromTemplate(template);

    expect(colors.primary).toBe('AABBCC');
    expect(colors.secondary).toBe('DDEEFF');
    expect(colors.text).toBe('112233');
    expect(colors.muted).toBe('445566');
  });
});
