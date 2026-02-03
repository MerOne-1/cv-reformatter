/**
 * Soniox Speech-to-Text API Client
 * Documentation: https://soniox.com/docs/stt/async/async-transcription
 */

const SONIOX_API_URL = 'https://api.soniox.com';

interface SonioxFileUploadResponse {
  id: string;  // L'API retourne "id", pas "file_id"
  filename: string;
  size: number;
}

interface SonioxTranscriptionResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
}

interface SonioxToken {
  text: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
  speaker?: string;
  language?: string;
}

interface SonioxTranscriptResponse {
  tokens: SonioxToken[];
}

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

class SonioxClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('SONIOX_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  private async apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${SONIOX_API_URL}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Soniox API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Upload an audio file to Soniox
   */
  async uploadFile(buffer: Buffer, filename: string): Promise<string> {
    const formData = new FormData();
    // Convert Buffer to ArrayBuffer then to Blob
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    formData.append('file', new Blob([arrayBuffer]), filename);

    const response = await this.apiFetch<SonioxFileUploadResponse>('/v1/files', {
      method: 'POST',
      body: formData,
    });

    return response.id;
  }

  /**
   * Create a transcription job
   */
  async createTranscription(
    fileId: string,
    options: {
      languageHints?: string[];
      enableSpeakerDiarization?: boolean;
    } = {}
  ): Promise<string> {
    const config: Record<string, unknown> = {
      model: 'stt-async-v4',
      file_id: fileId,
    };

    if (options.languageHints && options.languageHints.length > 0) {
      config.language_hints = options.languageHints;
    }

    if (options.enableSpeakerDiarization) {
      config.enable_speaker_diarization = true;
    }

    const response = await this.apiFetch<SonioxTranscriptionResponse>(
      '/v1/transcriptions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }
    );

    return response.id;
  }

  /**
   * Get transcription status
   */
  async getTranscriptionStatus(
    transcriptionId: string
  ): Promise<SonioxTranscriptionResponse> {
    return this.apiFetch<SonioxTranscriptionResponse>(
      `/v1/transcriptions/${transcriptionId}`
    );
  }

  /**
   * Get transcription result
   */
  async getTranscript(transcriptionId: string): Promise<TranscriptionResult> {
    const response = await this.apiFetch<SonioxTranscriptResponse>(
      `/v1/transcriptions/${transcriptionId}/transcript`
    );

    // Concatenate all tokens into text
    const text = response.tokens.map((t) => t.text).join('');

    // Detect primary language from tokens
    const languages = response.tokens
      .filter((t) => t.language)
      .map((t) => t.language!);
    const languageCounts = languages.reduce(
      (acc, lang) => {
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const primaryLanguage = Object.entries(languageCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    // Calculate duration from last token
    const lastToken = response.tokens[response.tokens.length - 1];
    const duration = lastToken?.end_ms ? Math.round(lastToken.end_ms / 1000) : undefined;

    return {
      text: text.trim(),
      language: primaryLanguage,
      duration,
    };
  }

  /**
   * Delete a transcription job
   */
  async deleteTranscription(transcriptionId: string): Promise<void> {
    await this.apiFetch(`/v1/transcriptions/${transcriptionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Transcribe an audio buffer with polling
   * This is a convenience method that handles the full flow
   */
  async transcribe(
    buffer: Buffer,
    filename: string,
    options: {
      languageHints?: string[];
      enableSpeakerDiarization?: boolean;
      pollIntervalMs?: number;
      maxWaitMs?: number;
      onProgress?: (status: string) => void;
    } = {}
  ): Promise<TranscriptionResult> {
    const {
      pollIntervalMs = 2000,
      maxWaitMs = 300000, // 5 minutes max
      onProgress,
    } = options;

    // Step 1: Upload file
    onProgress?.('uploading');
    const fileId = await this.uploadFile(buffer, filename);

    // Step 2: Create transcription job
    onProgress?.('processing');
    const transcriptionId = await this.createTranscription(fileId, {
      languageHints: options.languageHints,
      enableSpeakerDiarization: options.enableSpeakerDiarization,
    });

    // Step 3: Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getTranscriptionStatus(transcriptionId);

      if (status.status === 'completed') {
        onProgress?.('completed');
        // Step 4: Get transcript
        const result = await this.getTranscript(transcriptionId);

        // Cleanup: delete the transcription job
        try {
          await this.deleteTranscription(transcriptionId);
        } catch (e) {
          console.warn('Failed to cleanup Soniox transcription:', e);
        }

        return result;
      }

      if (status.status === 'error') {
        throw new Error(`Soniox transcription failed: ${status.error_message}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Soniox transcription timed out');
  }
}

// Singleton instance
let sonioxClient: SonioxClient | null = null;

export function getSonioxClient(): SonioxClient {
  if (!sonioxClient) {
    const apiKey = process.env.SONIOX_API_KEY;
    if (!apiKey) {
      throw new Error('SONIOX_API_KEY environment variable is not set');
    }
    sonioxClient = new SonioxClient(apiKey);
  }
  return sonioxClient;
}

export { SonioxClient, type TranscriptionResult };
