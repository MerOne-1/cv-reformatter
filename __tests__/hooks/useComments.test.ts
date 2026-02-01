import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useComments } from '@/hooks/useComments';

const mockComments = [
  {
    id: 'comment-1',
    content: 'First comment',
    userId: 'user-1',
    cvId: 'cv-1',
    startOffset: 0,
    endOffset: 10,
    resolved: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    user: { id: 'user-1', name: 'John', highlightColor: '#3B82F6' },
  },
  {
    id: 'comment-2',
    content: 'Second comment',
    userId: 'user-2',
    cvId: 'cv-1',
    startOffset: 20,
    endOffset: 30,
    resolved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    resolvedBy: 'user-1',
    user: { id: 'user-2', name: 'Jane', highlightColor: '#EC4899' },
  },
];

describe('useComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch comments on mount', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: mockComments }),
    });

    const { result } = renderHook(() =>
      useComments({ cvId: 'cv-1', userId: 'user-1' })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.comments).toEqual(mockComments);
    expect(global.fetch).toHaveBeenCalledWith('/api/comments?cvId=cv-1');
  });

  it('should handle fetch error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() =>
      useComments({ cvId: 'cv-1', userId: 'user-1' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should add a comment', async () => {
    const newComment = {
      id: 'comment-3',
      content: 'New comment',
      userId: 'user-1',
      cvId: 'cv-1',
      startOffset: 40,
      endOffset: 50,
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
      user: { id: 'user-1', name: 'John', highlightColor: '#3B82F6' },
    };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockComments }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: newComment }),
      });

    const { result } = renderHook(() =>
      useComments({ cvId: 'cv-1', userId: 'user-1' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addComment({
        content: 'New comment',
        startOffset: 40,
        endOffset: 50,
      });
    });

    expect(result.current.comments).toHaveLength(3);
  });

  it('should delete a comment', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockComments }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

    const { result } = renderHook(() =>
      useComments({ cvId: 'cv-1', userId: 'user-1' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteComment('comment-1');
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].id).toBe('comment-2');
  });

  it('should resolve a comment', async () => {
    const resolvedComment = {
      ...mockComments[0],
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'user-1',
    };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockComments }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: resolvedComment }),
      });

    const { result } = renderHook(() =>
      useComments({ cvId: 'cv-1', userId: 'user-1' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.resolveComment('comment-1', 'user-1');
    });

    expect(result.current.comments[0].resolved).toBe(true);
  });
});
