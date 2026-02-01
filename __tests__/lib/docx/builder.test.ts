import { describe, it, expect } from 'vitest';
import { buildHeader, buildFooter, buildContent } from '@/lib/docx/builder';
import { Header, Footer, Paragraph } from 'docx';
import { parseTemplateConfig } from '@/lib/templates/types';
import { TemplateColors } from '@/lib/docx/types';

const defaultColors: TemplateColors = {
  primary: '1E3A8A',
  secondary: '3B82F6',
  text: '1F2937',
  muted: '6B7280',
};

const defaultConfig = parseTemplateConfig('{}');

describe('buildHeader', () => {
  it('should return a Header instance', () => {
    const header = buildHeader(null, defaultConfig, defaultColors, 'TestBrand', 'JD');
    expect(header).toBeInstanceOf(Header);
  });

  it('should handle missing initials', () => {
    const header = buildHeader(null, defaultConfig, defaultColors, 'TestBrand');
    expect(header).toBeInstanceOf(Header);
  });

  it('should handle logo buffer', () => {
    const logoBuffer = Buffer.from('fake-png-data');
    const header = buildHeader(logoBuffer, defaultConfig, defaultColors, 'TestBrand', 'JD');
    expect(header).toBeInstanceOf(Header);
  });

  it('should use custom logo dimensions from config', () => {
    const customConfig = parseTemplateConfig(JSON.stringify({
      logos: {
        header: {
          width: 2400,
          height: 800,
        },
      },
    }));
    const logoBuffer = Buffer.from('fake-png-data');
    const header = buildHeader(logoBuffer, customConfig, defaultColors, 'TestBrand', 'AB');
    expect(header).toBeInstanceOf(Header);
  });
});

describe('buildFooter', () => {
  it('should return a Footer instance', () => {
    const footer = buildFooter(null, defaultConfig, defaultColors, 'TestBrand', 'www.test.com');
    expect(footer).toBeInstanceOf(Footer);
  });

  it('should handle missing website', () => {
    const footer = buildFooter(null, defaultConfig, defaultColors, 'TestBrand');
    expect(footer).toBeInstanceOf(Footer);
  });

  it('should handle logo buffer in footer', () => {
    const logoBuffer = Buffer.from('fake-png-data');
    const footer = buildFooter(logoBuffer, defaultConfig, defaultColors, 'TestBrand', 'www.test.com');
    expect(footer).toBeInstanceOf(Footer);
  });

  it('should use custom footer logo dimensions from config', () => {
    const customConfig = parseTemplateConfig(JSON.stringify({
      logos: {
        footer: {
          width: 1600,
          height: 500,
        },
      },
    }));
    const logoBuffer = Buffer.from('fake-png-data');
    const footer = buildFooter(logoBuffer, customConfig, defaultColors, 'TestBrand', 'www.example.com');
    expect(footer).toBeInstanceOf(Footer);
  });
});

describe('buildContent', () => {
  it('should return array of Paragraphs', () => {
    const sections = [
      { type: 'heading1' as const, content: 'Title' },
      { type: 'paragraph' as const, content: 'Some text' },
    ];
    const content = buildContent(sections, defaultConfig, defaultColors);
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBe(2);
    content.forEach(item => {
      expect(item).toBeInstanceOf(Paragraph);
    });
  });

  it('should handle all section types', () => {
    const sections = [
      { type: 'heading1' as const, content: 'H1 Title' },
      { type: 'heading2' as const, content: 'H2 Section' },
      { type: 'heading3' as const, content: 'H3 Subsection' },
      { type: 'paragraph' as const, content: 'A paragraph' },
      { type: 'list' as const, content: '', items: ['Item 1', 'Item 2'] },
      { type: 'separator' as const, content: '' },
    ];
    const content = buildContent(sections, defaultConfig, defaultColors);
    expect(content.length).toBeGreaterThan(sections.length - 1);
  });

  it('should handle empty sections', () => {
    const content = buildContent([], defaultConfig, defaultColors);
    expect(content).toEqual([]);
  });
});
