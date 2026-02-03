import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    cV: {
      findUnique: vi.fn(),
    },
    audioNote: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/b2', () => ({
  uploadAudio: vi.fn(),
  deleteFile: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/queue', () => ({
  getAudioTranscriptionQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  })),
}));

import prisma from '@/lib/db';
import { uploadAudio, getSignedDownloadUrl, deleteFile } from '@/lib/b2';
import { GET, POST } from '@/app/api/cv/[id]/audio/route';

const createContext = (id: string) => ({ params: Promise.resolve({ id }) });

// Helper to create a mock request with formData
function createMockRequest(
  url: string,
  formDataEntries: Record<string, File | null> = {}
) {
  const formData = new Map(Object.entries(formDataEntries));
  return {
    url,
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) ?? null,
    }),
  } as unknown as Request;
}

function createMockAudioFile(
  name: string,
  type: string,
  size: number = 1000
): File {
  const content = new ArrayBuffer(size);
  const file = new File([content], name, { type });
  // Add arrayBuffer method for Node.js test environment
  if (!file.arrayBuffer) {
    (file as any).arrayBuffer = async () => content;
  }
  return file;
}

describe('Audio API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cv/[id]/audio', () => {
    it('should return list of audio notes with signed URLs', async () => {
      const mockAudioNotes = [
        {
          id: 'audio-1',
          cvId: 'cv-1',
          originalName: 'note1.mp3',
          audioKey: 'audio/note1.mp3',
          status: 'COMPLETED',
          transcription: 'Transcription text',
          createdAt: new Date(),
        },
        {
          id: 'audio-2',
          cvId: 'cv-1',
          originalName: 'note2.ogg',
          audioKey: 'audio/note2.ogg',
          status: 'PENDING',
          transcription: null,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.cV.findUnique).mockResolvedValue({ id: 'cv-1' } as any);
      vi.mocked(prisma.audioNote.findMany).mockResolvedValue(mockAudioNotes as any);
      vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed-url.example.com');

      const request = createMockRequest('http://localhost/api/cv/cv-1/audio');
      const response = await GET(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].signedUrl).toBe('https://signed-url.example.com');
      expect(data.data[1].signedUrl).toBe('https://signed-url.example.com');
    });

    it('should return 404 when CV not found', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue(null);

      const request = createMockRequest('http://localhost/api/cv/cv-not-found/audio');
      const response = await GET(request as any, createContext('cv-not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('CV not found');
      expect(response.status).toBe(404);
    });

    it('should handle signed URL generation failure gracefully', async () => {
      const mockAudioNotes = [
        {
          id: 'audio-1',
          cvId: 'cv-1',
          audioKey: 'audio/note1.mp3',
        },
      ];

      vi.mocked(prisma.cV.findUnique).mockResolvedValue({ id: 'cv-1' } as any);
      vi.mocked(prisma.audioNote.findMany).mockResolvedValue(mockAudioNotes as any);
      vi.mocked(getSignedDownloadUrl).mockRejectedValue(new Error('B2 error'));

      const request = createMockRequest('http://localhost/api/cv/cv-1/audio');
      const response = await GET(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data[0].signedUrl).toBeNull();
    });
  });

  describe('POST /api/cv/[id]/audio', () => {
    it('should upload valid MP3 audio file', async () => {
      const mockCV = {
        id: 'cv-1',
        consultantName: 'Jean Dupont',
        originalName: 'cv.pdf',
      };

      const mockAudioNote = {
        id: 'audio-1',
        cvId: 'cv-1',
        originalName: 'recording.mp3',
        audioKey: 'audio/Jean_Dupont/recording.mp3',
        status: 'PENDING',
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(uploadAudio).mockResolvedValue({
        key: 'audio/Jean_Dupont/recording.mp3',
        url: 'https://b2.example.com/audio/Jean_Dupont/recording.mp3',
      });
      vi.mocked(prisma.audioNote.create).mockResolvedValue(mockAudioNote as any);
      vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com');

      const file = createMockAudioFile('recording.mp3', 'audio/mpeg');
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: file,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.originalName).toBe('recording.mp3');
      expect(data.data.signedUrl).toBe('https://signed.example.com');
    });

    it('should upload valid OGG audio file (WhatsApp format)', async () => {
      const mockCV = { id: 'cv-1', consultantName: 'Test', originalName: 'cv.pdf' };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(uploadAudio).mockResolvedValue({ key: 'key', url: 'url' });
      vi.mocked(prisma.audioNote.create).mockResolvedValue({ id: 'audio-1' } as any);
      vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com');

      const file = createMockAudioFile('voice.ogg', 'audio/ogg; codecs=opus');
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: file,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should upload audio with generic MIME type but valid extension', async () => {
      const mockCV = { id: 'cv-1', consultantName: 'Test', originalName: 'cv.pdf' };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(uploadAudio).mockResolvedValue({ key: 'key', url: 'url' });
      vi.mocked(prisma.audioNote.create).mockResolvedValue({ id: 'audio-1' } as any);
      vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com');

      const file = createMockAudioFile('voice.opus', 'application/octet-stream');
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: file,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should return 404 when CV not found', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue(null);

      const file = createMockAudioFile('recording.mp3', 'audio/mpeg');
      const request = createMockRequest('http://localhost/api/cv/cv-not-found/audio', {
        audio: file,
      });

      const response = await POST(request as any, createContext('cv-not-found'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('CV not found');
      expect(response.status).toBe(404);
    });

    it('should reject when no audio file provided', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue({ id: 'cv-1' } as any);

      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: null,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('No audio file provided');
      expect(response.status).toBe(400);
    });

    it('should reject invalid audio file type', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue({ id: 'cv-1' } as any);

      const file = createMockAudioFile('document.pdf', 'application/pdf');
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: file,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid audio file');
      expect(response.status).toBe(400);
    });

    it('should reject audio file exceeding 25MB', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue({ id: 'cv-1' } as any);

      const largeFile = createMockAudioFile(
        'large.mp3',
        'audio/mpeg',
        26 * 1024 * 1024 // 26MB
      );
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: largeFile,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('File too large');
      expect(response.status).toBe(400);
    });

    it('should use originalName when consultantName is null', async () => {
      const mockCV = {
        id: 'cv-1',
        consultantName: null,
        originalName: 'cv_jean_dupont.pdf',
      };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(uploadAudio).mockResolvedValue({ key: 'key', url: 'url' });
      vi.mocked(prisma.audioNote.create).mockResolvedValue({ id: 'audio-1' } as any);
      vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com');

      const file = createMockAudioFile('recording.mp3', 'audio/mpeg');
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: file,
      });

      await POST(request as any, createContext('cv-1'));

      expect(uploadAudio).toHaveBeenCalledWith(
        'cv_jean_dupont', // originalName without extension
        'recording.mp3',
        expect.any(Buffer),
        'audio/mpeg'
      );
    });

    it('should handle B2 upload failure', async () => {
      vi.mocked(prisma.cV.findUnique).mockResolvedValue({ id: 'cv-1', consultantName: 'Test' } as any);
      vi.mocked(uploadAudio).mockRejectedValue(new Error('B2 upload failed'));

      const file = createMockAudioFile('recording.mp3', 'audio/mpeg');
      const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
        audio: file,
      });

      const response = await POST(request as any, createContext('cv-1'));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should accept various audio formats', async () => {
      const mockCV = { id: 'cv-1', consultantName: 'Test', originalName: 'cv.pdf' };

      vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
      vi.mocked(uploadAudio).mockResolvedValue({ key: 'key', url: 'url' });
      vi.mocked(prisma.audioNote.create).mockResolvedValue({ id: 'audio-1' } as any);
      vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com');

      const formats = [
        { name: 'audio.m4a', type: 'audio/mp4' },
        { name: 'audio.wav', type: 'audio/wav' },
        { name: 'audio.webm', type: 'audio/webm' },
        { name: 'audio.aac', type: 'audio/aac' },
        { name: 'audio.flac', type: 'audio/flac' },
      ];

      for (const format of formats) {
        vi.clearAllMocks();
        vi.mocked(prisma.cV.findUnique).mockResolvedValue(mockCV as any);
        vi.mocked(uploadAudio).mockResolvedValue({ key: 'key', url: 'url' });
        vi.mocked(prisma.audioNote.create).mockResolvedValue({ id: 'audio-1' } as any);
        vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com');

        const file = createMockAudioFile(format.name, format.type);
        const request = createMockRequest('http://localhost/api/cv/cv-1/audio', {
          audio: file,
        });

        const response = await POST(request as any, createContext('cv-1'));
        const data = await response.json();

        expect(data.success).toBe(true);
      }
    });
  });
});
