'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CVList } from './cv-list';
import { CVListItem } from '@/lib/types';

interface CVSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSelectCV: (cv: CVListItem) => void;
  selectedId?: string;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  refreshKey: number;
}

export function CVSidebar({
  collapsed,
  onToggle,
  onSelectCV,
  selectedId,
  onRefresh,
  onDelete,
  refreshKey,
}: CVSidebarProps) {
  return (
    <>
      <div
        className={cn(
          'flex-shrink-0 border-r border-border bg-background-elevated transition-all duration-300 ease-out-expo overflow-hidden',
          collapsed ? 'w-0 border-r-0' : 'w-80'
        )}
      >
        <div className="h-full w-80">
          <CVList
            key={refreshKey}
            onSelectCV={onSelectCV}
            selectedId={selectedId}
            onRefresh={onRefresh}
            onDelete={onDelete}
            compact
          />
        </div>
      </div>

      <button
        onClick={onToggle}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 z-20 w-5 h-12 bg-card border border-border shadow-soft rounded-r-lg flex items-center justify-center hover:bg-card-hover transition-all duration-300 ease-out-expo group',
          collapsed ? 'left-0' : 'left-80'
        )}
        title={collapsed ? 'Ouvrir la liste' : 'Fermer la liste'}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>
    </>
  );
}
