import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateUserColor } from '@/hooks/useCollaboration';

vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn().mockImplementation(() => ({
    awareness: {
      setLocalStateField: vi.fn(),
      getStates: vi.fn().mockReturnValue(new Map()),
      on: vi.fn(),
      off: vi.fn(),
    },
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('yjs', () => ({
  Doc: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

describe('useCollaboration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateUserColor', () => {
    it('should return a valid hex color', () => {
      const color = generateUserColor('user-123');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return consistent color for same userId', () => {
      const color1 = generateUserColor('user-123');
      const color2 = generateUserColor('user-123');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different userIds', () => {
      const color1 = generateUserColor('user-123');
      const color2 = generateUserColor('user-456');
      expect(color1).not.toBe(color2);
    });

    it('should handle empty string', () => {
      const color = generateUserColor('');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should handle long strings', () => {
      const longId = 'a'.repeat(1000);
      const color = generateUserColor(longId);
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
