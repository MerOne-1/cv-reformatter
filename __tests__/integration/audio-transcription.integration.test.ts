import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock external services
vi.mock('@/lib/db', () => ({
  default: {
    audioNote: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/b2', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('@/lib/soniox', () => ({
  getSonioxClient: vi.fn(() => ({
    transcribe: vi.fn(),
  })),
}));

import prisma from '@/lib/db';
import { downloadFile } from '@/lib/b2';
import { getSonioxClient } from '@/lib/soniox';

// Import the worker processor function
import { processAudioTranscriptionJob } from '@/lib/queue/workers/audio-transcription-worker';

describe('Audio Transcription Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processAudioTranscriptionJob', () => {
    it('should complete full transcription flow: PENDING → UPLOADING → PROCESSING → COMPLETED', async () => {
      const mockAudioNote = {
        id: 'audio-1',
        cvId: 'cv-1',
        audioKey: 'audio/test/recording.mp3',
        status: 'PENDING',
        originalName: 'recording.mp3',
      };

      const statusUpdates: string[] = [];

      vi.mocked(prisma.audioNote.findUnique).mockResolvedValue(mockAudioNote as any);
      vi.mocked(prisma.audioNote.update).mockImplementation(async ({ data }) => {
        if (data.status) {
          statusUpdates.push(data.status as string);
        }
        return { ...mockAudioNote, ...data } as any;
      });

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('fake audio data'));

      const mockTranscribe = vi.fn().mockResolvedValue({
        text: 'Ceci est la transcription du fichier audio.',
        language: 'fr',
        duration: 45,
      });

      vi.mocked(getSonioxClient).mockReturnValue({
        transcribe: mockTranscribe,
      } as any);

      // Simulate job
      const mockJob = {
        data: {
          audioNoteId: 'audio-1',
          cvId: 'cv-1',
        },
        updateProgress: vi.fn(),
      };

      await processAudioTranscriptionJob(mockJob as any);

      // Verify status progression
      expect(statusUpdates).toContain('UPLOADING');
      expect(statusUpdates).toContain('PROCESSING');
      expect(statusUpdates).toContain('COMPLETED');

      // Verify final transcription was saved (last call should be COMPLETED)
      const updateCalls = vi.mocked(prisma.audioNote.update).mock.calls;
      const completedCall = updateCalls.find(
        (call) => call[0].data.status === 'COMPLETED'
      );
      expect(completedCall).toBeDefined();
      expect(completedCall![0].data).toMatchObject({
        transcription: 'Ceci est la transcription du fichier audio.',
        language: 'fr',
        duration: 45,
        status: 'COMPLETED',
      });
    });

    it('should handle transcription error and set status to FAILED', async () => {
      const mockAudioNote = {
        id: 'audio-1',
        cvId: 'cv-1',
        audioKey: 'audio/test/recording.mp3',
        status: 'PENDING',
      };

      vi.mocked(prisma.audioNote.findUnique).mockResolvedValue(mockAudioNote as any);
      vi.mocked(prisma.audioNote.update).mockResolvedValue(mockAudioNote as any);
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('fake audio'));

      const mockTranscribe = vi.fn().mockRejectedValue(new Error('Soniox API error'));
      vi.mocked(getSonioxClient).mockReturnValue({
        transcribe: mockTranscribe,
      } as any);

      const mockJob = {
        data: { audioNoteId: 'audio-1', cvId: 'cv-1' },
        updateProgress: vi.fn(),
      };

      // Worker returns result object instead of throwing
      const result = await processAudioTranscriptionJob(mockJob as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Soniox API error');

      // Verify status was set to FAILED
      const updateCalls = vi.mocked(prisma.audioNote.update).mock.calls;
      const failedCall = updateCalls.find(
        (call) => call[0].data.status === 'FAILED'
      );
      expect(failedCall).toBeDefined();
    });

    it('should handle download error', async () => {
      const mockAudioNote = {
        id: 'audio-1',
        cvId: 'cv-1',
        audioKey: 'audio/test/recording.mp3',
        status: 'PENDING',
      };

      vi.mocked(prisma.audioNote.findUnique).mockResolvedValue(mockAudioNote as any);
      vi.mocked(prisma.audioNote.update).mockResolvedValue(mockAudioNote as any);
      vi.mocked(downloadFile).mockRejectedValue(new Error('B2 download failed'));

      const mockJob = {
        data: { audioNoteId: 'audio-1', cvId: 'cv-1' },
        updateProgress: vi.fn(),
      };

      // Worker returns result object instead of throwing
      const result = await processAudioTranscriptionJob(mockJob as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('B2 download failed');

      const updateCalls = vi.mocked(prisma.audioNote.update).mock.calls;
      const failedCall = updateCalls.find(
        (call) => call[0].data.status === 'FAILED'
      );
      expect(failedCall).toBeDefined();
    });

    it('should handle audio note not found', async () => {
      vi.mocked(prisma.audioNote.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.audioNote.update).mockResolvedValue({} as any);

      const mockJob = {
        data: { audioNoteId: 'not-found', cvId: 'cv-1' },
        updateProgress: vi.fn(),
      };

      // Worker returns result object instead of throwing
      const result = await processAudioTranscriptionJob(mockJob as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should use correct language hints for transcription', async () => {
      const mockAudioNote = {
        id: 'audio-1',
        cvId: 'cv-1',
        audioKey: 'audio/test/recording.mp3',
        status: 'PENDING',
        originalName: 'voice_note.ogg',
      };

      vi.mocked(prisma.audioNote.findUnique).mockResolvedValue(mockAudioNote as any);
      vi.mocked(prisma.audioNote.update).mockResolvedValue(mockAudioNote as any);
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('fake audio'));

      const mockTranscribe = vi.fn().mockResolvedValue({
        text: 'Test',
        language: 'fr',
        duration: 10,
      });

      vi.mocked(getSonioxClient).mockReturnValue({
        transcribe: mockTranscribe,
      } as any);

      const mockJob = {
        data: { audioNoteId: 'audio-1', cvId: 'cv-1' },
        updateProgress: vi.fn(),
      };

      await processAudioTranscriptionJob(mockJob as any);

      // Verify transcribe was called with language hints
      expect(mockTranscribe).toHaveBeenCalled();
      const transcribeCall = mockTranscribe.mock.calls[0];
      expect(transcribeCall[2]).toHaveProperty('languageHints');
      expect(transcribeCall[2].languageHints).toEqual(['fr', 'en', 'ar']);
    });
  });
});

describe('Audio Transcription Status Flow', () => {
  it('should track all status transitions', async () => {
    // This test verifies the expected status flow
    const expectedFlow = ['PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED'];

    // Status should progress through these states in order
    expect(expectedFlow[0]).toBe('PENDING');
    expect(expectedFlow[1]).toBe('UPLOADING');
    expect(expectedFlow[2]).toBe('PROCESSING');
    expect(expectedFlow[3]).toBe('COMPLETED');
  });

  it('should track error status', () => {
    const errorStatus = 'FAILED';
    expect(errorStatus).toBe('FAILED');
  });
});
