'use client';

import { useState, useEffect } from 'react';
import { CVListItem, CVStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CVUpload } from '@/components/features/cv/cv-upload';
import { formatDate, truncateText } from '@/lib/utils';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  Trash2,
  User,
  Sparkles,
  FileCheck,
  Edit3,
  Upload as UploadIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CVListProps {
  onSelectCV: (cv: CVListItem) => void;
  selectedId?: string;
  onRefresh?: () => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

const statusConfig: Record<CVStatus, {
  color: string;
  dotColor: string;
  label: string;
  icon: React.ReactNode;
}> = {
  PENDING: {
    color: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground/50',
    label: 'En attente',
    icon: <Clock className="w-3 h-3" />,
  },
  EXTRACTED: {
    color: 'text-info',
    dotColor: 'bg-info',
    label: 'Extrait',
    icon: <FileCheck className="w-3 h-3" />,
  },
  EDITING: {
    color: 'text-warning',
    dotColor: 'bg-warning',
    label: 'Edition',
    icon: <Edit3 className="w-3 h-3" />,
  },
  IMPROVED: {
    color: 'text-rupturae',
    dotColor: 'bg-rupturae',
    label: 'Ameliore',
    icon: <Sparkles className="w-3 h-3" />,
  },
  GENERATED: {
    color: 'text-success',
    dotColor: 'bg-success',
    label: 'Pret',
    icon: <FileText className="w-3 h-3" />,
  },
  COMPLETED: {
    color: 'text-success',
    dotColor: 'bg-success',
    label: 'Termine',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

export function CVList({ onSelectCV, selectedId, onRefresh, onDelete, compact }: CVListProps) {
  const [cvs, setCVs] = useState<CVListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, cv: CVListItem) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Supprimer "${cv.consultantName || cv.originalName}" ?\n\nCette action supprimera egalement les fichiers de Backblaze B2.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(cv.id);
      const response = await fetch(`/api/cv/${cv.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setCVs((prev) => prev.filter((c) => c.id !== cv.id));
        onDelete?.(cv.id);
        onRefresh?.();
      } else {
        alert(`Erreur lors de la suppression: ${data.error}`);
      }
    } catch (err) {
      console.error('Error deleting CV:', err);
      alert('Erreur lors de la suppression du CV');
    } finally {
      setDeletingId(null);
    }
  };

  const fetchCVs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cv/list');
      const data = await response.json();
      if (data.success) {
        setCVs(data.data);
      }
    } catch (err) {
      console.error('Error fetching CVs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCVs();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            CV Sources
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
            {cvs.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            fetchCVs();
            onRefresh?.();
          }}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Upload */}
      <div className="flex-shrink-0 p-3 border-b border-border">
        <CVUpload
          onUploadComplete={() => {
            fetchCVs();
            onRefresh?.();
          }}
          compact
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto scrollbar-minimal">
        {loading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl loading-shimmer" />
            ))}
          </div>
        ) : cvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/50 border border-border flex items-center justify-center mb-4">
              <UploadIcon className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Aucun CV</p>
            <p className="text-xs text-muted-foreground/70">Deposez un fichier pour commencer</p>
          </div>
        ) : (
          <div className="p-2 space-y-1 stagger">
            {cvs.map((cv, index) => {
              const status = statusConfig[cv.status];
              const isSelected = selectedId === cv.id;
              const isCompleted = cv.status === 'COMPLETED';
              const isDeleting = deletingId === cv.id;
              const brandColor = cv.templateName === 'DREAMIT' ? 'dreamit' : 'rupturae';

              return (
                <div
                  key={cv.id}
                  className={cn(
                    'group relative w-full text-left rounded-xl transition-all duration-200 cursor-pointer overflow-hidden',
                    isSelected
                      ? `bg-${brandColor}/10 border border-${brandColor}/30`
                      : 'hover:bg-card-hover border border-transparent',
                    isDeleting && 'opacity-50 pointer-events-none'
                  )}
                  onClick={() => !isDeleting && onSelectCV(cv)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Brand accent line */}
                  <div
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-1 transition-opacity duration-200',
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
                      cv.templateName === 'DREAMIT'
                        ? 'bg-gradient-to-b from-dreamit to-dreamit-glow'
                        : 'bg-gradient-to-b from-rupturae to-rupturae-glow'
                    )}
                  />

                  <div className="p-3 pl-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar / Icon */}
                      <div className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                        isSelected
                          ? cv.templateName === 'DREAMIT'
                            ? 'bg-dreamit/20 text-dreamit'
                            : 'bg-rupturae/20 text-rupturae'
                          : 'bg-secondary text-muted-foreground'
                      )}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : cv.consultantName ? (
                          <User className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm font-medium truncate flex-1',
                            isSelected ? 'text-foreground' : 'text-foreground/90'
                          )}>
                            {cv.consultantName || truncateText(cv.originalName, 24)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                          {/* Status indicator */}
                          <span className={cn(
                            'inline-flex items-center gap-1.5 text-[11px]',
                            isSelected ? 'text-foreground/70' : status.color
                          )}>
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              isSelected
                                ? cv.templateName === 'DREAMIT' ? 'bg-dreamit' : 'bg-rupturae'
                                : status.dotColor,
                              isCompleted && 'ring-2 ring-success/20'
                            )} />
                            {status.label}
                          </span>

                          <span className="text-muted-foreground/30">·</span>

                          {/* Date */}
                          <span className={cn(
                            'text-[11px]',
                            isSelected ? 'text-foreground/50' : 'text-muted-foreground/70'
                          )}>
                            {formatDate(cv.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDelete(e, cv)}
                        disabled={isDeleting}
                        className={cn(
                          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                          'opacity-0 group-hover:opacity-100',
                          isSelected
                            ? 'hover:bg-white/10 text-foreground/50 hover:text-foreground'
                            : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive',
                          isDeleting && 'opacity-100 animate-pulse'
                        )}
                        title="Supprimer le CV"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
