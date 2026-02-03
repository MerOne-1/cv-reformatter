import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    cV: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workflowExecution: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/b2', () => ({
  listRawCVs: vi.fn(),
  getRawCVKey: vi.fn((name: string) => `cv-raw/${name}`),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('@/lib/types', () => ({
  detectMissingFields: vi.fn(() => []),
}));

import prisma from '@/lib/db';
import { listRawCVs, deleteFile } from '@/lib/b2';
import { detectMissingFields } from '@/lib/types';
import { GET, PATCH, DELETE } from '@/app/api/cv/[id]/route';
import { GET as listCVs } from '@/app/api/cv/list/route';

const createContext = (id: string) => ({ params: Promise.resolve({ id }) });
const emptyContext = { params: Promise.resolve({}) };

describe('CV CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cv/[id]', () => {
    it('should return CV with improvements and active workflow', async () => {
      const mockCV = {
        id: 'cv-1',
        originalName: 'test.pdf',
        markdownContent: '# CV Content',
        status: 'EXTRACTED',
        improvements: [
          { id: 'imp-1', agentType: 'enrichisseur', appliedAt: new Date() },
        ],
        audioNotes: [],
        workflowExecutions: [
          {
            id: 'exec-1',
            status: 'RUNNING',
            startedAt: new Date(),
            steps: [
              { status: 'COMPLETED' },
              { status: 'RUNNING' },
              { status: 'PENDING' },
            ],
          },
        ],
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);

      const request = new NextRequest('http://localhost/api/cv/cv-1');
      const response = await GET(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe('cv-1');
      expect(data.data.activeWorkflow).toEqual({
        id: 'exec-1',
        status: 'RUNNING',
        startedAt: mockCV.workflowExecutions[0].startedAt.toISOString(),
        progress: { completed: 1, total: 3 },
      });
    });

    it('should return CV without active workflow when none exists', async () => {
      const mockCV = {
        id: 'cv-1',
        originalName: 'test.pdf',
        markdownContent: '# CV Content',
        improvements: [],
        audioNotes: [],
        workflowExecutions: [],
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);

      const request = new NextRequest('http://localhost/api/cv/cv-1');
      const response = await GET(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.activeWorkflow).toBeNull();
    });

    it('should return 404 when CV not found', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/cv/cv-not-found');
      const response = await GET(request, createContext('cv-not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('CV not found');
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/cv/[id]', () => {
    it('should update markdown content', async () => {
      const updatedCV = {
        id: 'cv-1',
        markdownContent: '# Updated CV',
        status: 'EDITING',
      };

      vi.mocked(prisma.cV.update).mockResolvedValue(updatedCV as any);
      vi.mocked(detectMissingFields).mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'PATCH',
        body: JSON.stringify({ markdownContent: '# Updated CV' }),
      });

      const response = await PATCH(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.markdownContent).toBe('# Updated CV');
      expect(detectMissingFields).toHaveBeenCalledWith('# Updated CV');
    });

    it('should update notes fields', async () => {
      const updatedCV = {
        id: 'cv-1',
        notes: 'Past mission notes',
        futureMissionNotes: 'Future mission notes',
      };

      vi.mocked(prisma.cV.update).mockResolvedValue(updatedCV as any);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'PATCH',
        body: JSON.stringify({
          notes: 'Past mission notes',
          futureMissionNotes: 'Future mission notes',
        }),
      });

      const response = await PATCH(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(prisma.cV.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cv-1' },
          data: expect.objectContaining({
            notes: 'Past mission notes',
            futureMissionNotes: 'Future mission notes',
          }),
        })
      );
    });

    it('should update template name', async () => {
      const updatedCV = {
        id: 'cv-1',
        templateName: 'dreamit',
      };

      vi.mocked(prisma.cV.update).mockResolvedValue(updatedCV as any);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'PATCH',
        body: JSON.stringify({ templateName: 'dreamit' }),
      });

      const response = await PATCH(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.templateName).toBe('dreamit');
    });

    it('should update status', async () => {
      const updatedCV = {
        id: 'cv-1',
        status: 'COMPLETED',
      };

      vi.mocked(prisma.cV.update).mockResolvedValue(updatedCV as any);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      const response = await PATCH(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.status).toBe('COMPLETED');
    });

    it('should detect missing fields when updating markdown', async () => {
      vi.mocked(prisma.cV.update).mockResolvedValue({ id: 'cv-1' } as any);
      vi.mocked(detectMissingFields).mockReturnValue(['experience', 'education']);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'PATCH',
        body: JSON.stringify({
          markdownContent: '# CV with ##INFO MANQUANTE## markers',
        }),
      });

      await PATCH(request, createContext('cv-1'));

      expect(prisma.cV.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            missingFields: ['experience', 'education'],
          }),
        })
      );
    });

    it('should handle null notes', async () => {
      vi.mocked(prisma.cV.update).mockResolvedValue({ id: 'cv-1' } as any);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'PATCH',
        body: JSON.stringify({ notes: null }),
      });

      const response = await PATCH(request, createContext('cv-1'));

      expect(response.status).toBe(200);
      expect(prisma.cV.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: null,
          }),
        })
      );
    });
  });

  describe('DELETE /api/cv/[id]', () => {
    it('should delete CV and associated files', async () => {
      const mockCV = {
        originalKey: 'cv-raw/test.pdf',
        generatedKey: 'cv-final/test.docx',
        audioNotes: [
          { audioKey: 'audio/note1.mp3' },
          { audioKey: 'audio/note2.mp3' },
        ],
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          cV: {
            findUnique: vi.fn().mockResolvedValue(mockCV),
            delete: vi.fn().mockResolvedValue({ id: 'cv-1' }),
          },
        } as any);
      });

      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('CV deleted successfully');
      expect(deleteFile).toHaveBeenCalledTimes(4);
      expect(deleteFile).toHaveBeenCalledWith('cv-raw/test.pdf');
      expect(deleteFile).toHaveBeenCalledWith('cv-final/test.docx');
      expect(deleteFile).toHaveBeenCalledWith('audio/note1.mp3');
      expect(deleteFile).toHaveBeenCalledWith('audio/note2.mp3');
    });

    it('should return 404 when CV not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          cV: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        } as any);
      });

      const request = new NextRequest('http://localhost/api/cv/cv-not-found', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createContext('cv-not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('CV not found');
      expect(response.status).toBe(404);
    });

    it('should delete CV even if B2 deletion fails', async () => {
      const mockCV = {
        originalKey: 'cv-raw/test.pdf',
        generatedKey: null,
        audioNotes: [],
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          cV: {
            findUnique: vi.fn().mockResolvedValue(mockCV),
            delete: vi.fn().mockResolvedValue({ id: 'cv-1' }),
          },
        } as any);
      });

      vi.mocked(deleteFile).mockRejectedValue(new Error('B2 error'));

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.warnings).toContain('Failed to delete: cv-raw/test.pdf');
    });

    it('should handle CV without generated file', async () => {
      const mockCV = {
        originalKey: 'cv-raw/test.pdf',
        generatedKey: null,
        audioNotes: [],
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          cV: {
            findUnique: vi.fn().mockResolvedValue(mockCV),
            delete: vi.fn().mockResolvedValue({ id: 'cv-1' }),
          },
        } as any);
      });

      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/cv/cv-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createContext('cv-1'));

      expect(deleteFile).toHaveBeenCalledTimes(1);
      expect(deleteFile).toHaveBeenCalledWith('cv-raw/test.pdf');
    });
  });

  describe('GET /api/cv/list', () => {
    it('should return list of CVs synced with B2', async () => {
      const mockB2Files = [
        { name: 'cv1.pdf', size: 1000 },
        { name: 'cv2.docx', size: 2000 },
      ];

      const mockExistingCVs = [
        {
          id: 'cv-1',
          originalKey: 'cv-raw/cv1.pdf',
          originalName: 'cv1.pdf',
          consultantName: 'Jean Dupont',
          title: 'Developer',
          status: 'EXTRACTED',
          templateName: 'dreamit',
          createdAt: new Date(),
          updatedAt: new Date(),
          missingFields: [],
        },
      ];

      vi.mocked(listRawCVs).mockResolvedValue(mockB2Files);
      vi.mocked(prisma.cV.findMany).mockResolvedValue(mockExistingCVs as any);
      vi.mocked(prisma.workflowExecution.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.cV.create).mockResolvedValue({
        id: 'cv-2',
        originalName: 'cv2.docx',
        consultantName: null,
        title: null,
        status: 'PENDING',
        templateName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        missingFields: [],
      } as any);

      const request = new NextRequest('http://localhost/api/cv/list');
      const response = await listCVs(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('should mark CVs with active workflows', async () => {
      const mockB2Files = [{ name: 'cv1.pdf', size: 1000 }];

      const mockExistingCVs = [
        {
          id: 'cv-1',
          originalKey: 'cv-raw/cv1.pdf',
          originalName: 'cv1.pdf',
          consultantName: 'Jean',
          status: 'EXTRACTED',
          createdAt: new Date(),
          updatedAt: new Date(),
          missingFields: [],
        },
      ];

      vi.mocked(listRawCVs).mockResolvedValue(mockB2Files);
      vi.mocked(prisma.cV.findMany).mockResolvedValue(mockExistingCVs as any);
      vi.mocked(prisma.workflowExecution.groupBy).mockResolvedValue([
        { cvId: 'cv-1', _count: 1 },
      ] as any);

      const request = new NextRequest('http://localhost/api/cv/list');
      const response = await listCVs(request, emptyContext);
      const data = await response.json();

      expect(data.data[0].hasActiveWorkflow).toBe(true);
    });

    it('should mark CVs with missing fields', async () => {
      const mockB2Files = [{ name: 'cv1.pdf', size: 1000 }];

      const mockExistingCVs = [
        {
          id: 'cv-1',
          originalKey: 'cv-raw/cv1.pdf',
          originalName: 'cv1.pdf',
          status: 'EXTRACTED',
          createdAt: new Date(),
          updatedAt: new Date(),
          missingFields: ['experience', 'education'],
        },
      ];

      vi.mocked(listRawCVs).mockResolvedValue(mockB2Files);
      vi.mocked(prisma.cV.findMany).mockResolvedValue(mockExistingCVs as any);
      vi.mocked(prisma.workflowExecution.groupBy).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/cv/list');
      const response = await listCVs(request, emptyContext);
      const data = await response.json();

      expect(data.data[0].hasMissingFields).toBe(true);
    });

    it('should return empty list when no files in B2', async () => {
      vi.mocked(listRawCVs).mockResolvedValue([]);
      vi.mocked(prisma.cV.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workflowExecution.groupBy).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/cv/list');
      const response = await listCVs(request, emptyContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
    });
  });
});
