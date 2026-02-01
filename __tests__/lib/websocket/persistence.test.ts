import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/queue/connection', () => ({
  getRedisConnection: vi.fn().mockReturnValue({
    getBuffer: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
  }),
}));

import { getPersistence, deleteDocument, documentExists } from '@/lib/websocket/persistence';
import { getRedisConnection } from '@/lib/queue/connection';

describe('WebSocket Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPersistence', () => {
    it('should return persistence object with bindState and writeState', () => {
      const persistence = getPersistence();

      expect(persistence).toHaveProperty('bindState');
      expect(persistence).toHaveProperty('writeState');
      expect(typeof persistence.bindState).toBe('function');
      expect(typeof persistence.writeState).toBe('function');
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from Redis', async () => {
      await deleteDocument('test-doc');

      const mockRedis = getRedisConnection();
      expect(mockRedis.del).toHaveBeenCalledWith('yjs:doc:test-doc');
    });
  });

  describe('documentExists', () => {
    it('should return true when document exists', async () => {
      const result = await documentExists('test-doc');

      expect(result).toBe(true);
      const mockRedis = getRedisConnection();
      expect(mockRedis.exists).toHaveBeenCalledWith('yjs:doc:test-doc');
    });
  });
});
