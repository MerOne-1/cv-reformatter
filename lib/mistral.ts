import { retryWithBackoff } from './utils';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_ENDPOINT = process.env.MISTRAL_CHAT_ENDPOINT || 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralResponse {
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
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function askMistral(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  return retryWithBackoff(async () => {
    const response = await fetch(MISTRAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: options?.maxTokens || 8192,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }

    const data: MistralResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Mistral');
    }

    return data.choices[0].message.content;
  }, 3, 1000);
}

export async function askMistralWithHistory(
  systemPrompt: string,
  messages: MistralMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  return retryWithBackoff(async () => {
    const allMessages: MistralMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await fetch(MISTRAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.model || DEFAULT_MODEL,
        messages: allMessages,
        max_tokens: options?.maxTokens || 8192,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }

    const data: MistralResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Mistral');
    }

    return data.choices[0].message.content;
  }, 3, 1000);
}

export { DEFAULT_MODEL };
