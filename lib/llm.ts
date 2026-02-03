import { retryWithBackoff } from './utils';

// Configuration LLM générique - compatible avec OpenAI, Mistral, Groq, Together, Ollama, etc.
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '8192', 10);

// Timeout pour les requêtes API (3 minutes par défaut)
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '180000', 10);

/**
 * Fetch avec timeout via AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = LLM_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
    const response = await fetchWithTimeout(LLM_ENDPOINT, {
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

    const response = await fetchWithTimeout(LLM_ENDPOINT, {
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

// ============================================================================
// MISTRAL OCR - Extraction de documents
// ============================================================================

const MISTRAL_OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';
const MISTRAL_OCR_MODEL = 'mistral-ocr-latest';

interface MistralOCRPage {
  index: number;
  markdown: string;
  images?: Array<{
    id: string;
    base64?: string;
  }>;
  dimensions?: {
    width: number;
    height: number;
  };
}

interface MistralOCRResponse {
  pages: MistralOCRPage[];
  model: string;
  usage_info?: {
    pages_processed: number;
  };
}

export interface OCRResult {
  markdown: string;
  pagesProcessed: number;
  model: string;
}

/**
 * Extrait le texte d'un document via Mistral OCR
 * @param documentUrl - URL publique ou signée du document (PDF, DOCX, images)
 * @returns Le contenu en Markdown et les métadonnées
 */
export async function extractWithMistralOCR(documentUrl: string): Promise<OCRResult> {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY non configurée. Ajoutez LLM_API_KEY dans le fichier .env');
  }

  return retryWithBackoff(async () => {
    const response = await fetchWithTimeout(MISTRAL_OCR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_OCR_MODEL,
        document: {
          type: 'document_url',
          document_url: documentUrl,
        },
        include_image_base64: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral OCR error: ${response.status} - ${error}`);
    }

    const data: MistralOCRResponse = await response.json();

    if (!data.pages || data.pages.length === 0) {
      throw new Error('Mistral OCR: aucune page extraite du document');
    }

    // Combiner le Markdown de toutes les pages
    const markdown = data.pages
      .map(page => page.markdown)
      .join('\n\n---\n\n');

    return {
      markdown,
      pagesProcessed: data.pages.length,
      model: data.model,
    };
  }, 3, 1000);
}

/**
 * Extrait le texte d'un document via Mistral OCR en utilisant base64
 * @param base64Content - Contenu du document encodé en base64
 * @param mimeType - Type MIME du document (application/pdf, image/jpeg, etc.)
 * @returns Le contenu en Markdown et les métadonnées
 */
export async function extractWithMistralOCRBase64(
  base64Content: string,
  mimeType: string
): Promise<OCRResult> {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY non configurée. Ajoutez LLM_API_KEY dans le fichier .env');
  }

  // Déterminer le type de document pour l'API
  const isImage = mimeType.startsWith('image/');
  const documentType = isImage ? 'image_url' : 'document_url';
  const urlKey = isImage ? 'image_url' : 'document_url';

  return retryWithBackoff(async () => {
    const response = await fetchWithTimeout(MISTRAL_OCR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_OCR_MODEL,
        document: {
          type: documentType,
          [urlKey]: `data:${mimeType};base64,${base64Content}`,
        },
        include_image_base64: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral OCR error: ${response.status} - ${error}`);
    }

    const data: MistralOCRResponse = await response.json();

    if (!data.pages || data.pages.length === 0) {
      throw new Error('Mistral OCR: aucune page extraite du document');
    }

    const markdown = data.pages
      .map(page => page.markdown)
      .join('\n\n---\n\n');

    return {
      markdown,
      pagesProcessed: data.pages.length,
      model: data.model,
    };
  }, 3, 1000);
}

export { LLM_MODEL as DEFAULT_MODEL };
