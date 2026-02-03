import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    cV: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/b2', () => ({
  uploadFile: vi.fn(),
  getRawCVKey: vi.fn((name: string) => `cv-raw/${name}`),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    validateCVMagicBytes: vi.fn(),
  };
});

import prisma from '@/lib/db';
import { uploadFile } from '@/lib/b2';
import { validateCVMagicBytes } from '@/lib/utils';
import { POST } from '@/app/api/cv/upload/route';

// PDF magic bytes
const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
// DOCX magic bytes (ZIP)
const DOCX_MAGIC_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;

// Helper to create a mock request with formData
function createMockRequest(formDataEntries: Record<string, File | null>) {
  const formData = new Map(Object.entries(formDataEntries));
  return {
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) ?? null,
    }),
  } as unknown as Request;
}

// Helper to create a mock File with arrayBuffer support
function createMockFile(
  name: string,
  content: ArrayBuffer,
  type: string
): File {
  const file = new File([content], name, { type });
  // Add arrayBuffer method for Node.js test environment
  if (!file.arrayBuffer) {
    (file as any).arrayBuffer = async () => content;
  }
  return file;
}

describe('CV Upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default successful behavior
    vi.mocked(validateCVMagicBytes).mockReturnValue(true);
  });

  describe('POST /api/cv/upload', () => {
    it('should upload valid PDF file', async () => {
      const mockCV = {
        id: 'cv-1',
        originalName: 'test.pdf',
        status: 'PENDING',
      };

      vi.mocked(uploadFile).mockResolvedValue('https://b2.example.com/cv-raw/test.pdf');
      vi.mocked(prisma.cV.create).mockResolvedValue(mockCV as any);

      const file = createMockFile('test.pdf', PDF_MAGIC_BYTES, 'application/pdf');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe('cv-1');
      expect(data.data.originalName).toBe('test.pdf');
      expect(data.data.status).toBe('PENDING');
    });

    it('should upload valid DOCX file', async () => {
      const mockCV = {
        id: 'cv-2',
        originalName: 'test.docx',
        status: 'PENDING',
      };

      vi.mocked(uploadFile).mockResolvedValue('https://b2.example.com/cv-raw/test.docx');
      vi.mocked(prisma.cV.create).mockResolvedValue(mockCV as any);

      const file = createMockFile(
        'test.docx',
        DOCX_MAGIC_BYTES,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.originalName).toBe('test.docx');
    });

    it('should reject when no file provided', async () => {
      const request = createMockRequest({ file: null });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('No file provided');
      expect(response.status).toBe(400);
    });

    it('should reject invalid file type', async () => {
      const file = createMockFile('test.txt', new ArrayBuffer(100), 'text/plain');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid file type');
      expect(response.status).toBe(400);
    });

    it('should reject file exceeding 10MB', async () => {
      // Create a file larger than 10MB
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);

      const file = createMockFile('large.pdf', largeBuffer, 'application/pdf');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('File too large');
      expect(response.status).toBe(400);
    });

    it('should reject file with invalid magic bytes', async () => {
      vi.mocked(validateCVMagicBytes).mockReturnValueOnce(false);

      // Fake PDF file with wrong content
      const fakeContent = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
      const file = createMockFile('fake.pdf', fakeContent, 'application/pdf');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid file content');
      expect(response.status).toBe(400);
    });

    it('should reject executable disguised as PDF', async () => {
      vi.mocked(validateCVMagicBytes).mockReturnValueOnce(false);

      // EXE magic bytes
      const exeContent = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]).buffer;
      const file = createMockFile('malware.pdf', exeContent, 'application/pdf');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid file content');
    });

    it('should handle B2 upload failure', async () => {
      vi.mocked(uploadFile).mockRejectedValue(new Error('B2 upload failed'));

      const file = createMockFile('test.pdf', PDF_MAGIC_BYTES, 'application/pdf');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to upload CV');
      expect(response.status).toBe(500);
    });

    it('should handle database error', async () => {
      vi.mocked(uploadFile).mockResolvedValue('https://b2.example.com/test.pdf');
      vi.mocked(prisma.cV.create).mockRejectedValue(new Error('DB error'));

      const file = createMockFile('test.pdf', PDF_MAGIC_BYTES, 'application/pdf');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to upload CV');
      expect(response.status).toBe(500);
    });

    it('should accept DOC files', async () => {
      const mockCV = {
        id: 'cv-3',
        originalName: 'test.doc',
        status: 'PENDING',
      };

      vi.mocked(uploadFile).mockResolvedValue('https://b2.example.com/cv-raw/test.doc');
      vi.mocked(prisma.cV.create).mockResolvedValue(mockCV as any);

      // OLE2 magic bytes for old DOC format
      const docMagicBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer;
      const file = createMockFile('test.doc', docMagicBytes, 'application/msword');
      const request = createMockRequest({ file });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.originalName).toBe('test.doc');
    });
  });
});
