import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

import { auth } from '@/lib/auth';
import { getAuthenticatedUser, getAuthenticatedSession, requireAuth } from '@/lib/auth-guard';

describe('auth-guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthenticatedUser', () => {
    it('should return null when not authenticated', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const user = await getAuthenticatedUser();

      expect(user).toBe(null);
      expect(auth.api.getSession).toHaveBeenCalled();
    });

    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: mockUser,
        session: { id: 'session-123' },
      } as Awaited<ReturnType<typeof auth.api.getSession>>);

      const user = await getAuthenticatedUser();

      expect(user).toEqual(mockUser);
    });
  });

  describe('getAuthenticatedSession', () => {
    it('should return null when not authenticated', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const session = await getAuthenticatedSession();

      expect(session).toBe(null);
    });

    it('should return full session when authenticated', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'john@example.com' },
        session: { id: 'session-123', userId: 'user-123' },
      };

      vi.mocked(auth.api.getSession).mockResolvedValue(
        mockSession as Awaited<ReturnType<typeof auth.api.getSession>>
      );

      const session = await getAuthenticatedSession();

      expect(session).toEqual(mockSession);
    });
  });

  describe('requireAuth', () => {
    it('should throw when not authenticated', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow('Unauthorized');
    });

    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: mockUser,
        session: { id: 'session-123' },
      } as Awaited<ReturnType<typeof auth.api.getSession>>);

      const user = await requireAuth();

      expect(user).toEqual(mockUser);
    });
  });
});
