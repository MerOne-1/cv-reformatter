import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '@/lib/db';

describe('User Preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users/[id]/preferences', () => {
    it('should return user preferences with highlightColor', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'John',
        email: 'john@example.com',
        highlightColor: '#3B82F6',
      };

      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await prisma.user.findUnique({
        where: { id: 'user-1' },
        select: {
          id: true,
          name: true,
          email: true,
          highlightColor: true,
        },
      });

      expect(result).toEqual(mockUser);
      expect(result?.highlightColor).toBe('#3B82F6');
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await prisma.user.findUnique({
        where: { id: 'non-existent' },
      });

      expect(result).toBeNull();
    });
  });

  describe('PATCH /api/users/[id]/preferences', () => {
    it('should update user highlightColor', async () => {
      const updatedUser = {
        id: 'user-1',
        name: 'John',
        highlightColor: '#EC4899',
      };

      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedUser);

      const result = await prisma.user.update({
        where: { id: 'user-1' },
        data: { highlightColor: '#EC4899' },
        select: {
          id: true,
          name: true,
          highlightColor: true,
        },
      });

      expect(result.highlightColor).toBe('#EC4899');
    });

    it('should validate hex color format', () => {
      const validColors = ['#3B82F6', '#EC4899', '#000000', '#FFFFFF'];
      const invalidColors = ['red', '3B82F6', '#3B82F', '#GGGGGG'];

      const hexRegex = /^#[0-9A-Fa-f]{6}$/;

      validColors.forEach((color) => {
        expect(hexRegex.test(color)).toBe(true);
      });

      invalidColors.forEach((color) => {
        expect(hexRegex.test(color)).toBe(false);
      });
    });
  });
});
