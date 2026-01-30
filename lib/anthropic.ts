import Anthropic from '@anthropic-ai/sdk';
import { retryWithBackoff } from './utils';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  return retryWithBackoff(async () => {
    const response = await anthropic.messages.create({
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || MAX_TOKENS,
      temperature: options?.temperature ?? 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return content.text;
  }, 3, 1000);
}

export async function askClaudeWithHistory(
  systemPrompt: string,
  messages: ClaudeMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  return retryWithBackoff(async () => {
    const response = await anthropic.messages.create({
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || MAX_TOKENS,
      temperature: options?.temperature ?? 0.3,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return content.text;
  }, 3, 1000);
}

export { anthropic, DEFAULT_MODEL, MAX_TOKENS };
