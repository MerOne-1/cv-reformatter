import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    comment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from '@/lib/db';

describe('Comments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/comments', () => {
    it('should return comments for a CV', async () => {
      const mockComments = [
        {
          id: 'comment-1',
          content: 'Test comment',
          userId: 'user-1',
          cvId: 'cv-1',
          startOffset: 0,
          endOffset: 10,
          resolved: false,
          createdAt: new Date(),
          user: { id: 'user-1', name: 'John', highlightColor: '#3B82F6' },
        },
      ];

      (prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockComments);

      const result = await prisma.comment.findMany({
        where: { cvId: 'cv-1' },
        include: {
          user: {
            select: { id: true, name: true, highlightColor: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toEqual(mockComments);
      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { cvId: 'cv-1' },
        include: {
          user: {
            select: { id: true, name: true, highlightColor: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('POST /api/comments', () => {
    it('should create a new comment', async () => {
      const mockComment = {
        id: 'comment-1',
        content: 'New comment',
        userId: 'user-1',
        cvId: 'cv-1',
        startOffset: 5,
        endOffset: 15,
        resolved: false,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'John', highlightColor: '#3B82F6' },
      };

      (prisma.comment.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockComment);

      const result = await prisma.comment.create({
        data: {
          content: 'New comment',
          userId: 'user-1',
          cvId: 'cv-1',
          startOffset: 5,
          endOffset: 15,
        },
        include: {
          user: {
            select: { id: true, name: true, highlightColor: true },
          },
        },
      });

      expect(result.content).toBe('New comment');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('PATCH /api/comments/[id]', () => {
    it('should update comment content', async () => {
      const updatedComment = {
        id: 'comment-1',
        content: 'Updated content',
        resolved: false,
      };

      (prisma.comment.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedComment);

      const result = await prisma.comment.update({
        where: { id: 'comment-1' },
        data: { content: 'Updated content' },
      });

      expect(result.content).toBe('Updated content');
    });

    it('should mark comment as resolved', async () => {
      const resolvedComment = {
        id: 'comment-1',
        content: 'Test',
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: 'user-2',
      };

      (prisma.comment.update as ReturnType<typeof vi.fn>).mockResolvedValue(resolvedComment);

      const result = await prisma.comment.update({
        where: { id: 'comment-1' },
        data: {
          resolved: true,
          resolvedAt: expect.any(Date),
          resolvedBy: 'user-2',
        },
      });

      expect(result.resolved).toBe(true);
    });
  });

  describe('DELETE /api/comments/[id]', () => {
    it('should delete a comment', async () => {
      (prisma.comment.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'comment-1' });

      await prisma.comment.delete({
        where: { id: 'comment-1' },
      });

      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
    });
  });
});
