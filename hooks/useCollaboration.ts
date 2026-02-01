'use client';

import { useState, useEffect, useRef } from 'react';
import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CollaborativeUser } from '@/lib/types';

interface UseCollaborationOptions {
  documentId: string;
  userId: string;
  userName: string;
  userColor?: string;
  persistedColor?: string;
}

interface UseCollaborationReturn {
  ydoc: Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  users: CollaborativeUser[];
  error: Error | null;
  userColor: string;
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:1234';

export function useCollaboration({
  documentId,
  userId,
  userName,
  userColor: providedColor,
  persistedColor,
}: UseCollaborationOptions): UseCollaborationReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<CollaborativeUser[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const ydocRef = useRef<Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const userColor = persistedColor || providedColor || generateUserColor(userId);

  useEffect(() => {
    if (!documentId) return;

    const ydoc = new Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(WEBSOCKET_URL, documentId, ydoc, {
      connect: true,
      maxBackoffTime: 2500,
    });
    providerRef.current = provider;

    provider.awareness.setLocalStateField('user', {
      id: userId,
      name: userName,
      color: userColor,
    });

    const handleStatus = ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
      if (status === 'connected') {
        setError(null);
      }
    };

    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const connectedUsers: CollaborativeUser[] = states
        .filter((state): state is { user: CollaborativeUser } => state?.user != null)
        .map((state) => state.user)
        .filter((user) => user.id !== userId);

      setUsers(connectedUsers);
    };

    const handleConnectionError = () => {
      setError(new Error('WebSocket connection failed'));
      setIsConnected(false);
    };

    provider.on('status', handleStatus);
    provider.awareness.on('change', handleAwarenessChange);
    provider.on('connection-error', handleConnectionError);

    handleAwarenessChange();

    return () => {
      provider.off('status', handleStatus);
      provider.awareness.off('change', handleAwarenessChange);
      provider.off('connection-error', handleConnectionError);

      provider.disconnect();
      provider.destroy();
      ydoc.destroy();

      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [documentId, userId, userName, userColor]);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    isConnected,
    users,
    error,
    userColor,
  };
}

export function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
