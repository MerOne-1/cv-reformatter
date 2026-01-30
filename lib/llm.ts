import { retryWithBackoff } from './utils';

// Configuration LLM générique - compatible avec OpenAI, Mistral, Groq, Together, Ollama, etc.
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '8192', 10);

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function askLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY non configurée. Ajoutez LLM_API_KEY dans le fichier .env');
  }

  return retryWithBackoff(async () => {
    const response = await fetch(LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.model || LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: options?.maxTokens || LLM_MAX_TOKENS,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data: LLMResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('Pas de réponse du LLM');
    }

    return data.choices[0].message.content;
  }, 3, 1000);
}

export async function askLLMWithHistory(
  systemPrompt: string,
  messages: LLMMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY non configurée. Ajoutez LLM_API_KEY dans le fichier .env');
  }

  return retryWithBackoff(async () => {
    const allMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await fetch(LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.model || LLM_MODEL,
        messages: allMessages,
        max_tokens: options?.maxTokens || LLM_MAX_TOKENS,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data: LLMResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('Pas de réponse du LLM');
    }

    return data.choices[0].message.content;
  }, 3, 1000);
}

export { LLM_MODEL as DEFAULT_MODEL };
