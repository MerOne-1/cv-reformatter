import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Check if an IP is in the private 172.16.0.0/12 range (172.16.0.0 - 172.31.255.255)
 */
function isPrivate172Range(hostname: string): boolean {
  const match = hostname.match(/^172\.(\d+)\./);
  if (!match) return false;
  const secondOctet = parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

const querySchema = z.object({
  url: z.string().url().refine((url) => {
    const parsed = new URL(url);
    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      isPrivate172Range(hostname) ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '0.0.0.0'
    ) {
      return false;
    }
    // Only allow http/https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  }, { message: 'Invalid or blocked URL' }),
});

export const GET = apiRoute()
  .query(querySchema)
  .handler(async (_, { query }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(query.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Propagate appropriate status code
        const status = response.status >= 500 ? 502 : response.status;
        return error(`Failed to fetch image: ${response.status}`, status);
      }

      // Validate content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return error('URL does not return an image', 400);
      }

      // Check content length
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_IMAGE_SIZE) {
        return error('Image too large', 413);
      }

      const buffer = await response.arrayBuffer();

      // Double check size after download
      if (buffer.byteLength > MAX_IMAGE_SIZE) {
        return error('Image too large', 413);
      }

      const base64 = Buffer.from(buffer).toString('base64');

      return NextResponse.json({
        base64: `data:${contentType};base64,${base64}`
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        return error('Request timeout', 408);
      }
      throw e;
    }
  });
