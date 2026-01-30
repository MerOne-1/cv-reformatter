import { describe, it, expect } from 'vitest';
import {
  TemplateConfigSchema,
  parseTemplateConfig,
  toTemplateWithParsedConfig,
  LogosConfigSchema,
  MarginsConfigSchema,
  FontsConfigSchema,
  PaginationConfigSchema,
} from '@/lib/templates/types';

describe('TemplateConfigSchema', () => {
  it('should parse valid config with all fields', () => {
    const config = {
      logos: {
        header: { width: 1800, height: 600, position: 'top-left' },
        footer: { width: 1200, height: 400, position: 'center' },
      },
      margins: { top: 1800, bottom: 1440, left: 1080, right: 1080 },
      fonts: { family: 'Arial', titleSize: 48, bodySize: 22 },
      pagination: { keepWithNext: true, keepLines: true, widowControl: true },
      styles: { heading2Uppercase: true, heading2Border: true },
      sections: ['initials', 'title', 'bio'],
    };

    const result = TemplateConfigSchema.parse(config);

    expect(result.logos.header?.width).toBe(1800);
    expect(result.margins.top).toBe(1800);
    expect(result.fonts.family).toBe('Arial');
    expect(result.pagination.keepWithNext).toBe(true);
  });

  it('should apply defaults for missing fields', () => {
    const result = TemplateConfigSchema.parse({});

    expect(result.logos).toBeDefined();
    expect(result.margins.top).toBe(1800);
    expect(result.margins.bottom).toBe(1440);
    expect(result.fonts.family).toBe('Arial');
    expect(result.pagination.keepWithNext).toBe(true);
    expect(result.sections).toContain('initials');
  });

  it('should merge partial config with defaults', () => {
    const config = {
      fonts: { family: 'Calibri' },
    };

    const result = TemplateConfigSchema.parse(config);

    expect(result.fonts.family).toBe('Calibri');
    expect(result.fonts.titleSize).toBe(48); // default
    expect(result.margins.top).toBe(1800); // default
  });
});

describe('LogosConfigSchema', () => {
  it('should validate header logo config', () => {
    const config = {
      header: {
        width: 2000,
        height: 700,
        marginTop: 500,
        marginLeft: 400,
        position: 'top-left' as const,
      },
    };

    const result = LogosConfigSchema.parse(config);

    expect(result.header?.width).toBe(2000);
    expect(result.header?.position).toBe('top-left');
  });

  it('should validate footer logo config', () => {
    const config = {
      footer: {
        width: 1000,
        height: 350,
        position: 'center' as const,
      },
    };

    const result = LogosConfigSchema.parse(config);

    expect(result.footer?.width).toBe(1000);
    expect(result.footer?.position).toBe('center');
  });
});

describe('MarginsConfigSchema', () => {
  it('should validate margin values', () => {
    const config = {
      top: 2000,
      bottom: 1500,
      left: 1200,
      right: 1200,
    };

    const result = MarginsConfigSchema.parse(config);

    expect(result.top).toBe(2000);
    expect(result.bottom).toBe(1500);
  });
});

describe('FontsConfigSchema', () => {
  it('should validate font config', () => {
    const config = {
      family: 'Helvetica',
      titleSize: 52,
      heading2Size: 30,
      bodySize: 24,
    };

    const result = FontsConfigSchema.parse(config);

    expect(result.family).toBe('Helvetica');
    expect(result.titleSize).toBe(52);
  });
});

describe('PaginationConfigSchema', () => {
  it('should validate pagination settings', () => {
    const config = {
      keepWithNext: false,
      keepLines: false,
      widowControl: false,
    };

    const result = PaginationConfigSchema.parse(config);

    expect(result.keepWithNext).toBe(false);
    expect(result.keepLines).toBe(false);
    expect(result.widowControl).toBe(false);
  });
});

describe('parseTemplateConfig', () => {
  it('should parse valid JSON string', () => {
    const json = JSON.stringify({
      fonts: { family: 'Times New Roman' },
    });

    const result = parseTemplateConfig(json);

    expect(result.fonts.family).toBe('Times New Roman');
  });

  it('should return defaults for null input', () => {
    const result = parseTemplateConfig(null);

    expect(result.fonts.family).toBe('Arial');
    expect(result.margins.top).toBe(1800);
  });

  it('should return defaults for undefined input', () => {
    const result = parseTemplateConfig(undefined);

    expect(result.fonts.family).toBe('Arial');
  });

  it('should return defaults for invalid JSON', () => {
    const result = parseTemplateConfig('{ invalid json }');

    expect(result.fonts.family).toBe('Arial');
  });

  it('should return defaults for empty string', () => {
    const result = parseTemplateConfig('');

    expect(result.fonts.family).toBe('Arial');
  });
});

describe('toTemplateWithParsedConfig', () => {
  it('should convert Prisma template to typed template', () => {
    const prismaTemplate = {
      id: 'test-id',
      name: 'DREAMIT',
      displayName: 'DreamIT',
      primaryColor: '#0C4A6E',
      secondaryColor: '#0EA5E9',
      textColor: '#1F2937',
      mutedColor: '#6B7280',
      logoUrl: null,
      logoHeaderUrl: 'https://example.com/header.png',
      logoFooterUrl: 'https://example.com/footer.png',
      website: 'www.dreamit.com',
      config: JSON.stringify({ fonts: { family: 'Calibri' } }),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = toTemplateWithParsedConfig(prismaTemplate);

    expect(result.id).toBe('test-id');
    expect(result.name).toBe('DREAMIT');
    expect(result.config.fonts.family).toBe('Calibri');
    expect(result.logoHeaderUrl).toBe('https://example.com/header.png');
  });
});
