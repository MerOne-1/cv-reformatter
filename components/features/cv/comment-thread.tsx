'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { CommentWithUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  MoreHorizontal,
  Trash2,
  Edit2,
  X,
  CheckCircle,
} from 'lucide-react';

interface CommentThreadProps {
  comment: CommentWithUser;
  isSelected?: boolean;
  onSelect?: () => void;
  onResolve?: () => void;
  onDelete?: () => void;
  onEdit?: (content: string) => void;
  currentUserId?: string;
}

export function CommentThread({
  comment,
  isSelected = false,
  onSelect,
  onResolve,
  onDelete,
  onEdit,
  currentUserId,
}: CommentThreadProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showActions, setShowActions] = useState(false);

  const isOwner = currentUserId === comment.userId;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
    locale: fr,
  });

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit?.(editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-secondary/30',
        comment.resolved && 'opacity-60'
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
          style={{
            backgroundColor: `${comment.user.highlightColor}30`,
            color: comment.user.highlightColor,
          }}
        >
          {comment.user.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {comment.user.name}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {comment.resolved && (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle className="w-3 h-3" />
                Résolu
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Sauvegarder
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                >
                  <X className="w-3 h-3 mr-1" />
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
              {comment.content}
            </p>
          )}
        </div>

        {showActions && !isEditing && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {!comment.resolved && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onResolve}
                title="Marquer comme résolu"
              >
                <Check className="w-3.5 h-3.5 text-success" />
              </Button>
            )}
            {isOwner && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(true)}
                  title="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: comment.user.highlightColor }}
      />
    </div>
  );
}
