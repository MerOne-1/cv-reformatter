import { Doc, encodeStateAsUpdate, applyUpdate } from 'yjs';
import { getRedisConnection } from '../queue/connection';

const REDIS_KEY_PREFIX = 'yjs:doc:';
const REDIS_KEY_TTL = 60 * 60 * 24 * 7; // 7 days
const DEBOUNCE_MS = 2000; // Debounce Redis writes

export interface YjsPersistence {
  bindState: (docName: string, ydoc: Doc) => Promise<void>;
  writeState: (docName: string, ydoc: Doc) => Promise<void>;
}

async function loadDocument(docName: string): Promise<Uint8Array | null> {
  const redis = getRedisConnection();
  const key = `${REDIS_KEY_PREFIX}${docName}`;

  const data = await redis.getBuffer(key);
  if (data) {
    console.log(`[Persistence] Loaded document: ${docName} (${data.length} bytes)`);
    return new Uint8Array(data);
  }

  return null;
}

async function storeDocument(docName: string, ydoc: Doc): Promise<void> {
  try {
    const redis = getRedisConnection();
    const key = `${REDIS_KEY_PREFIX}${docName}`;

    const state = encodeStateAsUpdate(ydoc);
    await redis.setex(key, REDIS_KEY_TTL, Buffer.from(state));

    console.log(`[Persistence] Stored document: ${docName} (${state.length} bytes)`);
  } catch (error) {
    console.error(`[Persistence] Failed to store document ${docName}:`, error);
  }
}

export function getPersistence(): YjsPersistence {
  const debounceTimers = new Map<string, NodeJS.Timeout>();

  return {
    bindState: async (docName: string, ydoc: Doc) => {
      const persistedState = await loadDocument(docName);

      if (persistedState) {
        applyUpdate(ydoc, persistedState);
      }

      ydoc.on('update', () => {
        const existingTimer = debounceTimers.get(docName);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
          debounceTimers.delete(docName);
          await storeDocument(docName, ydoc);
        }, DEBOUNCE_MS);

        debounceTimers.set(docName, timer);
      });
    },

    writeState: async (docName: string, ydoc: Doc) => {
      await storeDocument(docName, ydoc);
    },
  };
}

export async function deleteDocument(docName: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `${REDIS_KEY_PREFIX}${docName}`;
  await redis.del(key);
  console.log(`[Persistence] Deleted document: ${docName}`);
}

export async function documentExists(docName: string): Promise<boolean> {
  const redis = getRedisConnection();
  const key = `${REDIS_KEY_PREFIX}${docName}`;
  const exists = await redis.exists(key);
  return exists === 1;
}
