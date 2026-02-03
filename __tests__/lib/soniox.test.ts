import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SonioxClient, getSonioxClient } from '@/lib/soniox';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SonioxClient', () => {
  let client: SonioxClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SonioxClient('test-api-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with valid API key', () => {
      const client = new SonioxClient('valid-key');
      expect(client).toBeInstanceOf(SonioxClient);
    });

    it('should throw error when API key is empty', () => {
      expect(() => new SonioxClient('')).toThrow('SONIOX_API_KEY is required');
    });

    it('should throw error when API key is undefined', () => {
      expect(() => new SonioxClient(undefined as unknown as string)).toThrow(
        'SONIOX_API_KEY is required'
      );
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return file ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'file-123',
          filename: 'audio.mp3',
          size: 1024,
        }),
      });

      const buffer = Buffer.from('fake audio data');
      const fileId = await client.uploadFile(buffer, 'audio.mp3');

      expect(fileId).toBe('file-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.soniox.com/v1/files',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw error on upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid file format',
      });

      const buffer = Buffer.from('fake audio');
      await expect(client.uploadFile(buffer, 'audio.mp3')).rejects.toThrow(
        'Soniox API error (400): Invalid file format'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const buffer = Buffer.from('fake audio');
      await expect(client.uploadFile(buffer, 'audio.mp3')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('createTranscription', () => {
    it('should create transcription job and return ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'trans-456',
          status: 'pending',
        }),
      });

      const transcriptionId = await client.createTranscription('file-123');

      expect(transcriptionId).toBe('trans-456');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.soniox.com/v1/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('stt-async-v4');
      expect(callBody.file_id).toBe('file-123');
    });

    it('should include language hints when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'pending' }),
      });

      await client.createTranscription('file-123', {
        languageHints: ['fr', 'en', 'ar'],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.language_hints).toEqual(['fr', 'en', 'ar']);
    });

    it('should enable speaker diarization when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'pending' }),
      });

      await client.createTranscription('file-123', {
        enableSpeakerDiarization: true,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.enable_speaker_diarization).toBe(true);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(client.createTranscription('file-123')).rejects.toThrow(
        'Soniox API error (500): Internal server error'
      );
    });
  });

  describe('getTranscriptionStatus', () => {
    it('should return pending status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'trans-456',
          status: 'pending',
        }),
      });

      const status = await client.getTranscriptionStatus('trans-456');

      expect(status.status).toBe('pending');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.soniox.com/v1/transcriptions/trans-456',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should return processing status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'trans-456',
          status: 'processing',
        }),
      });

      const status = await client.getTranscriptionStatus('trans-456');
      expect(status.status).toBe('processing');
    });

    it('should return completed status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'trans-456',
          status: 'completed',
        }),
      });

      const status = await client.getTranscriptionStatus('trans-456');
      expect(status.status).toBe('completed');
    });

    it('should return error status with message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'trans-456',
          status: 'error',
          error_message: 'Audio file corrupted',
        }),
      });

      const status = await client.getTranscriptionStatus('trans-456');
      expect(status.status).toBe('error');
      expect(status.error_message).toBe('Audio file corrupted');
    });
  });

  describe('getTranscript', () => {
    it('should return transcript text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [
            { text: 'Hello ', language: 'en', end_ms: 500 },
            { text: 'world', language: 'en', end_ms: 1000 },
          ],
        }),
      });

      const result = await client.getTranscript('trans-456');

      expect(result.text).toBe('Hello world');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.soniox.com/v1/transcriptions/trans-456/transcript',
        expect.anything()
      );
    });

    it('should detect primary language from tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [
            { text: 'Bonjour ', language: 'fr' },
            { text: 'le ', language: 'fr' },
            { text: 'monde ', language: 'fr' },
            { text: 'hello', language: 'en' },
          ],
        }),
      });

      const result = await client.getTranscript('trans-456');
      expect(result.language).toBe('fr');
    });

    it('should calculate duration from last token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [
            { text: 'Word 1 ', end_ms: 1000 },
            { text: 'Word 2 ', end_ms: 2500 },
            { text: 'Word 3', end_ms: 45000 },
          ],
        }),
      });

      const result = await client.getTranscript('trans-456');
      expect(result.duration).toBe(45); // 45000ms = 45s
    });

    it('should handle empty tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [],
        }),
      });

      const result = await client.getTranscript('trans-456');
      expect(result.text).toBe('');
      expect(result.language).toBeUndefined();
      expect(result.duration).toBeUndefined();
    });

    it('should handle tokens without language info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [
            { text: 'Text without language' },
          ],
        }),
      });

      const result = await client.getTranscript('trans-456');
      expect(result.text).toBe('Text without language');
      expect(result.language).toBeUndefined();
    });
  });

  describe('deleteTranscription', () => {
    it('should delete transcription successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        client.deleteTranscription('trans-456')
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.soniox.com/v1/transcriptions/trans-456',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should throw error on delete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Transcription not found',
      });

      await expect(client.deleteTranscription('trans-456')).rejects.toThrow(
        'Soniox API error (404): Transcription not found'
      );
    });
  });

  describe('transcribe (full flow)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should complete full transcription flow', async () => {
      // Mock upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      // Mock create transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'pending' }),
      });

      // Mock status check - completed immediately
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'completed' }),
      });

      // Mock get transcript
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [{ text: 'Transcribed text', language: 'en', end_ms: 5000 }],
        }),
      });

      // Mock delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const buffer = Buffer.from('audio data');
      const onProgress = vi.fn();

      const resultPromise = client.transcribe(buffer, 'audio.mp3', {
        languageHints: ['fr', 'en'],
        onProgress,
      });

      const result = await resultPromise;

      expect(result.text).toBe('Transcribed text');
      expect(result.language).toBe('en');
      expect(result.duration).toBe(5);
      expect(onProgress).toHaveBeenCalledWith('uploading');
      expect(onProgress).toHaveBeenCalledWith('processing');
      expect(onProgress).toHaveBeenCalledWith('completed');
    });

    it('should poll until completion', async () => {
      vi.useRealTimers(); // Use real timers for this test

      // Mock upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      // Mock create transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'pending' }),
      });

      // Mock status checks - processing then completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'processing' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'completed' }),
      });

      // Mock get transcript
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: [{ text: 'Done', end_ms: 1000 }],
        }),
      });

      // Mock delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const buffer = Buffer.from('audio data');
      const result = await client.transcribe(buffer, 'audio.mp3', {
        pollIntervalMs: 10, // Very short poll interval for testing
      });

      expect(result.text).toBe('Done');
      // Upload + create + 2 status checks + transcript + delete = 6 calls
      expect(mockFetch).toHaveBeenCalledTimes(6);

      vi.useFakeTimers(); // Restore fake timers for other tests
    }, 10000);

    it('should throw error on transcription failure', async () => {
      // Mock upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      // Mock create transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'pending' }),
      });

      // Mock status - error
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'trans-456',
          status: 'error',
          error_message: 'Unsupported audio format',
        }),
      });

      const buffer = Buffer.from('audio data');

      await expect(
        client.transcribe(buffer, 'audio.mp3')
      ).rejects.toThrow('Soniox transcription failed: Unsupported audio format');
    });

    it('should timeout after max wait time', async () => {
      vi.useRealTimers(); // Use real timers for this test

      // Mock upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      // Mock create transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'pending' }),
      });

      // Mock status - always processing
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'trans-456', status: 'processing' }),
      });

      const buffer = Buffer.from('audio data');

      // Use very short timeouts for testing
      await expect(
        client.transcribe(buffer, 'audio.mp3', {
          pollIntervalMs: 10,
          maxWaitMs: 50,
        })
      ).rejects.toThrow('Soniox transcription timed out');

      vi.useFakeTimers(); // Restore fake timers for other tests
    }, 10000);
  });
});

describe('getSonioxClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SONIOX_API_KEY', 'test-soniox-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return singleton instance', async () => {
    const { getSonioxClient: getClient } = await import('@/lib/soniox');

    const client1 = getClient();
    const client2 = getClient();

    expect(client1).toBe(client2);
  });

  it('should throw error when API key is not set', async () => {
    vi.stubEnv('SONIOX_API_KEY', '');
    vi.resetModules();

    const { getSonioxClient: getClient } = await import('@/lib/soniox');

    expect(() => getClient()).toThrow(
      'SONIOX_API_KEY environment variable is not set'
    );
  });
});
