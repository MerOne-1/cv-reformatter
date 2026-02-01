'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CommentThread } from './comment-thread';
import { CommentWithUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  X,
  Send,
  Filter,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface CommentPanelProps {
  comments: CommentWithUser[];
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (content: string) => Promise<void>;
  onResolveComment: (id: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onEditComment: (id: string, content: string) => Promise<void>;
  onSelectComment?: (comment: CommentWithUser) => void;
  selectedCommentId?: string | null;
  currentUserId?: string;
  loading?: boolean;
}

type FilterType = 'all' | 'open' | 'resolved';

export function CommentPanel({
  comments,
  isOpen,
  onClose,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onEditComment,
  onSelectComment,
  selectedCommentId,
  currentUserId,
  loading = false,
}: CommentPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredComments = comments.filter((comment) => {
    if (filter === 'open') return !comment.resolved;
    if (filter === 'resolved') return comment.resolved;
    return true;
  });

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, submitting, onAddComment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Commentaires</h3>
          <span className="text-xs text-muted-foreground">
            ({comments.length})
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'ghost'}
          className="h-7 text-xs"
          onClick={() => setFilter('all')}
        >
          Tous ({comments.length})
        </Button>
        <Button
          size="sm"
          variant={filter === 'open' ? 'default' : 'ghost'}
          className="h-7 text-xs gap-1"
          onClick={() => setFilter('open')}
        >
          <Clock className="w-3 h-3" />
          Ouverts ({openCount})
        </Button>
        <Button
          size="sm"
          variant={filter === 'resolved' ? 'default' : 'ghost'}
          className="h-7 text-xs gap-1"
          onClick={() => setFilter('resolved')}
        >
          <CheckCircle className="w-3 h-3" />
          Résolus ({resolvedCount})
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all'
                ? 'Aucun commentaire'
                : filter === 'open'
                ? 'Aucun commentaire ouvert'
                : 'Aucun commentaire résolu'}
            </p>
            {filter === 'all' && (
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez du texte pour ajouter un commentaire
              </p>
            )}
          </div>
        ) : (
          filteredComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              isSelected={selectedCommentId === comment.id}
              onSelect={() => onSelectComment?.(comment)}
              onResolve={() => onResolveComment(comment.id)}
              onDelete={() => onDeleteComment(comment.id)}
              onEdit={(content) => onEditComment(comment.id, content)}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-border">
        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ajouter un commentaire..."
            className={cn(
              'w-full px-3 py-2 pr-10 text-sm bg-secondary/50 border border-border rounded-lg',
              'resize-none focus:outline-none focus:ring-2 focus:ring-primary/50',
              'placeholder:text-muted-foreground'
            )}
            rows={2}
            disabled={submitting}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-6 w-6"
            disabled={!newComment.trim() || submitting}
            onClick={handleSubmit}
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ctrl+Enter pour envoyer
        </p>
      </div>
    </div>
  );
}
