'use client';

import { useMemo } from 'react';
import type { CollaborativeUser } from '@/lib/types';

interface CursorOverlayProps {
  users: CollaborativeUser[];
}

export function CursorOverlay({ users }: CursorOverlayProps) {
  const userBadges = useMemo(() => {
    return users.map((user) => (
      <div
        key={user.id}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-background/80 backdrop-blur-sm border shadow-sm"
        style={{ borderColor: user.color }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: user.color }}
        />
        <span className="text-foreground/80">{user.name}</span>
      </div>
    ));
  }, [users]);

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
      <span className="text-xs text-muted-foreground">
        {users.length === 1 ? '1 collaborateur' : `${users.length} collaborateurs`} en ligne:
      </span>
      <div className="flex flex-wrap gap-1.5">{userBadges}</div>
    </div>
  );
}

interface CollaborationStatusProps {
  isConnected: boolean;
  usersCount: number;
  error: Error | null;
}

export function CollaborationStatus({ isConnected, usersCount, error }: CollaborationStatusProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <span className="w-2 h-2 rounded-full bg-destructive" />
        <span>Déconnecté</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        <span>Connexion...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      <span>
        {usersCount === 0
          ? 'Connecté'
          : usersCount === 1
            ? '1 autre utilisateur'
            : `${usersCount} autres utilisateurs`}
      </span>
    </div>
  );
}
