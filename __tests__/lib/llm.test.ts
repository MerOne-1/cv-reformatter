import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables before importing the module
const mockEnv = {
  LLM_API_KEY: 'test-api-key',
  LLM_ENDPOINT: 'https://api.test.com/v1/chat/completions',
  LLM_MODEL: 'test-model',
  LLM_MAX_TOKENS: '4096',
};

vi.stubEnv('LLM_API_KEY', mockEnv.LLM_API_KEY);
vi.stubEnv('LLM_ENDPOINT', mockEnv.LLM_ENDPOINT);
vi.stubEnv('LLM_MODEL', mockEnv.LLM_MODEL);
vi.stubEnv('LLM_MAX_TOKENS', mockEnv.LLM_MAX_TOKENS);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock retryWithBackoff to avoid delays in tests
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    retryWithBackoff: async <T>(fn: () => Promise<T>) => fn(),
  };
});

// Import after mocking
const { askLLM, askLLMWithHistory, DEFAULT_MODEL } = await import('@/lib/llm');

describe('askLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return content on successful response', async () => {
    const mockResponse = {
      id: 'chat-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is the LLM response',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await askLLM('System prompt', 'User prompt');

    expect(result).toBe('This is the LLM response');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      mockEnv.LLM_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockEnv.LLM_API_KEY}`,
        },
      })
    );
  });

  it('should send correct request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
      }),
    });

    await askLLM('System prompt', 'User prompt');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody).toEqual({
      model: mockEnv.LLM_MODEL,
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User prompt' },
      ],
      max_tokens: parseInt(mockEnv.LLM_MAX_TOKENS),
      temperature: 0.3,
    });
  });

  it('should use custom options when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
      }),
    });

    await askLLM('System', 'User', {
      model: 'custom-model',
      maxTokens: 1000,
      temperature: 0.7,
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('custom-model');
    expect(callBody.max_tokens).toBe(1000);
    expect(callBody.temperature).toBe(0.7);
  });

  it('should throw error on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    await expect(askLLM('System', 'User')).rejects.toThrow(
      'LLM API error: 429 - Rate limit exceeded'
    );
  });

  it('should throw error on 500 server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });

    await expect(askLLM('System', 'User')).rejects.toThrow(
      'LLM API error: 500 - Internal server error'
    );
  });

  it('should throw error when choices array is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [],
      }),
    });

    await expect(askLLM('System', 'User')).rejects.toThrow(
      'Pas de réponse du LLM'
    );
  });

  it('should throw error when choices is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(askLLM('System', 'User')).rejects.toThrow(
      'Pas de réponse du LLM'
    );
  });

  it('should throw error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(askLLM('System', 'User')).rejects.toThrow('Network error');
  });
});

describe('askLLMWithHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return content on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Response with history',
            },
          },
        ],
      }),
    });

    const result = await askLLMWithHistory('System prompt', [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second message' },
    ]);

    expect(result).toBe('Response with history');
  });

  it('should send system prompt as first message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
      }),
    });

    await askLLMWithHistory('System prompt', [
      { role: 'user', content: 'User message' },
    ]);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages).toEqual([
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'User message' },
    ]);
  });

  it('should preserve message history order', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
      }),
    });

    const messages = [
      { role: 'user' as const, content: 'Message 1' },
      { role: 'assistant' as const, content: 'Response 1' },
      { role: 'user' as const, content: 'Message 2' },
    ];

    await askLLMWithHistory('System', messages);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages).toHaveLength(4); // system + 3 messages
    expect(callBody.messages[0].role).toBe('system');
    expect(callBody.messages[1].content).toBe('Message 1');
    expect(callBody.messages[2].content).toBe('Response 1');
    expect(callBody.messages[3].content).toBe('Message 2');
  });

  it('should use custom options when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
      }),
    });

    await askLLMWithHistory(
      'System',
      [{ role: 'user', content: 'User' }],
      {
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.5,
      }
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('gpt-4');
    expect(callBody.max_tokens).toBe(2000);
    expect(callBody.temperature).toBe(0.5);
  });

  it('should throw error on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      askLLMWithHistory('System', [{ role: 'user', content: 'User' }])
    ).rejects.toThrow('LLM API error: 401 - Unauthorized');
  });

  it('should throw error when choices is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    });

    await expect(
      askLLMWithHistory('System', [{ role: 'user', content: 'User' }])
    ).rejects.toThrow('Pas de réponse du LLM');
  });
});

describe('DEFAULT_MODEL', () => {
  it('should export the configured model', () => {
    expect(DEFAULT_MODEL).toBe(mockEnv.LLM_MODEL);
  });
});

describe('askLLM without API key', () => {
  it('should throw error when LLM_API_KEY is not set', async () => {
    // Create a new module instance without API key
    vi.stubEnv('LLM_API_KEY', '');

    // Re-import to get new instance
    vi.resetModules();

    // Mock utils again for the new module
    vi.doMock('@/lib/utils', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/utils')>();
      return {
        ...actual,
        retryWithBackoff: async <T>(fn: () => Promise<T>) => fn(),
      };
    });

    const { askLLM: askLLMNoKey } = await import('@/lib/llm');

    await expect(askLLMNoKey('System', 'User')).rejects.toThrow(
      'LLM_API_KEY non configurée'
    );

    // Restore
    vi.stubEnv('LLM_API_KEY', mockEnv.LLM_API_KEY);
  });
});
