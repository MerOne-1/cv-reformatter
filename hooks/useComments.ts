'use client';

import { useState, useCallback, useEffect } from 'react';
import { CommentWithUser, CommentCreate, CommentUpdate } from '@/lib/types';

interface UseCommentsOptions {
  cvId: string;
  userId: string;
}

interface UseCommentsReturn {
  comments: CommentWithUser[];
  loading: boolean;
  error: string | null;
  addComment: (data: Omit<CommentCreate, 'cvId'>) => Promise<CommentWithUser | null>;
  updateComment: (id: string, data: CommentUpdate) => Promise<CommentWithUser | null>;
  deleteComment: (id: string) => Promise<boolean>;
  resolveComment: (id: string, resolvedBy: string) => Promise<CommentWithUser | null>;
  refreshComments: () => Promise<void>;
}

export function useComments({ cvId, userId }: UseCommentsOptions): UseCommentsReturn {
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!cvId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/comments?cvId=${encodeURIComponent(cvId)}`);
      const data = await response.json();

      if (data.success) {
        setComments(data.data);
      } else {
        setError(data.error || 'Failed to fetch comments');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    } finally {
      setLoading(false);
    }
  }, [cvId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(
    async (data: Omit<CommentCreate, 'cvId'>): Promise<CommentWithUser | null> => {
      try {
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            cvId,
          }),
        });

        const result = await response.json();

        if (result.success) {
          const newComment = result.data as CommentWithUser;
          setComments((prev) => [...prev, newComment]);
          return newComment;
        } else {
          setError(result.error || 'Failed to add comment');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add comment');
        return null;
      }
    },
    [cvId]
  );

  const updateComment = useCallback(
    async (id: string, data: CommentUpdate): Promise<CommentWithUser | null> => {
      try {
        const response = await fetch(`/api/comments/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
          const updatedComment = result.data as CommentWithUser;
          setComments((prev) =>
            prev.map((c) => (c.id === id ? updatedComment : c))
          );
          return updatedComment;
        } else {
          setError(result.error || 'Failed to update comment');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update comment');
        return null;
      }
    },
    []
  );

  const deleteComment = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setComments((prev) => prev.filter((c) => c.id !== id));
        return true;
      } else {
        setError(result.error || 'Failed to delete comment');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      return false;
    }
  }, []);

  const resolveComment = useCallback(
    async (id: string, resolvedBy: string): Promise<CommentWithUser | null> => {
      return updateComment(id, { resolved: true, resolvedBy });
    },
    [updateComment]
  );

  const refreshComments = useCallback(async () => {
    await fetchComments();
  }, [fetchComments]);

  return {
    comments,
    loading,
    error,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    refreshComments,
  };
}
