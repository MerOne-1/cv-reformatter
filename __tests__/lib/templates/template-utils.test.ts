import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    template: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/b2', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

import { prisma } from '@/lib/db';
import { uploadFile, deleteFile } from '@/lib/b2';
import {
  loadLogoFromUrl,
  getTemplateByName,
  getTemplateById,
  getAllActiveTemplates,
  getTemplateLogoKey,
} from '@/lib/templates/template-utils';

describe('loadLogoFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should return null for null url', async () => {
    const result = await loadLogoFromUrl(null);
    expect(result).toBeNull();
  });

  it('should return null for undefined url', async () => {
    const result = await loadLogoFromUrl(undefined);
    expect(result).toBeNull();
  });

  it('should return buffer for valid url', async () => {
    const mockData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData.buffer),
    });

    const result = await loadLogoFromUrl('https://example.com/logo.png');

    expect(result).toBeInstanceOf(Buffer);
    expect(result?.length).toBe(4);
  });

  it('should return null on fetch error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const result = await loadLogoFromUrl('https://example.com/logo.png');

    expect(result).toBeNull();
  });

  it('should return null on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await loadLogoFromUrl('https://example.com/logo.png');

    expect(result).toBeNull();
  });
});

describe('getTemplateByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return template with parsed config', async () => {
    const mockTemplate = {
      id: 'test-id',
      name: 'DREAMIT',
      displayName: 'DreamIT',
      primaryColor: '#0C4A6E',
      secondaryColor: '#0EA5E9',
      textColor: '#1F2937',
      mutedColor: '#6B7280',
      logoUrl: null,
      logoHeaderUrl: null,
      logoFooterUrl: null,
      website: 'www.dreamit.com',
      config: JSON.stringify({ fonts: { family: 'Arial' } }),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplate);

    const result = await getTemplateByName('dreamit');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('DREAMIT');
    expect(result?.config.fonts.family).toBe('Arial');
    expect(prisma.template.findUnique).toHaveBeenCalledWith({
      where: { name: 'DREAMIT' },
    });
  });

  it('should return null for non-existent template', async () => {
    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getTemplateByName('nonexistent');

    expect(result).toBeNull();
  });
});

describe('getTemplateById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return template by id', async () => {
    const mockTemplate = {
      id: 'test-id',
      name: 'DREAMIT',
      displayName: 'DreamIT',
      primaryColor: '#0C4A6E',
      secondaryColor: '#0EA5E9',
      textColor: '#1F2937',
      mutedColor: '#6B7280',
      logoUrl: null,
      logoHeaderUrl: null,
      logoFooterUrl: null,
      website: null,
      config: '{}',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplate);

    const result = await getTemplateById('test-id');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('test-id');
  });

  it('should return null for non-existent id', async () => {
    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getTemplateById('non-existent');

    expect(result).toBeNull();
  });
});

describe('getAllActiveTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all active templates', async () => {
    const mockTemplates = [
      {
        id: '1',
        name: 'DREAMIT',
        displayName: 'DreamIT',
        primaryColor: '#0C4A6E',
        secondaryColor: '#0EA5E9',
        textColor: '#1F2937',
        mutedColor: '#6B7280',
        logoUrl: null,
        logoHeaderUrl: null,
        logoFooterUrl: null,
        website: null,
        config: '{}',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'RUPTURAE',
        displayName: 'Rupturae',
        primaryColor: '#7C3AED',
        secondaryColor: '#A78BFA',
        textColor: '#1F2937',
        mutedColor: '#6B7280',
        logoUrl: null,
        logoHeaderUrl: null,
        logoFooterUrl: null,
        website: null,
        config: '{}',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (prisma.template.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);

    const result = await getAllActiveTemplates();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('DREAMIT');
    expect(result[1].name).toBe('RUPTURAE');
    expect(prisma.template.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  });
});

describe('getTemplateLogoKey', () => {
  it('should generate correct key for header logo', () => {
    const key = getTemplateLogoKey('DREAMIT', 'header', 'png');
    expect(key).toBe('templates/dreamit/logo-header.png');
  });

  it('should generate correct key for footer logo', () => {
    const key = getTemplateLogoKey('RUPTURAE', 'footer', 'jpg');
    expect(key).toBe('templates/rupturae/logo-footer.jpg');
  });

  it('should use default extension', () => {
    const key = getTemplateLogoKey('TEST', 'header');
    expect(key).toBe('templates/test/logo-header.png');
  });
});
