'use client';

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { Provider } from '@lexical/yjs';
import { WebsocketProvider } from 'y-websocket';
import { Doc } from 'yjs';
import { TRANSFORMERS } from '@lexical/markdown';

import { lexicalTheme, editorPlaceholder } from './lexical-theme';
import { lexicalNodes, MarkdownExportPlugin } from './lexical-plugins';
import { CursorOverlay, CollaborationStatus } from './cursor-overlay';
import { generateUserColor } from '@/hooks/useCollaboration';
import {
  AuthorHighlightNode,
  CommentMarkNode,
} from './lexical-extensions';
import type { CollaborativeUser } from '@/lib/types';

interface CollaborativeEditorProps {
  documentId: string;
  userId: string;
  userName: string;
  userColor?: string;
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:1234';

function Placeholder() {
  return (
    <div className="absolute top-5 left-5 text-muted-foreground pointer-events-none">
      {editorPlaceholder}
    </div>
  );
}

export function CollaborativeEditor({
  documentId,
  userId,
  userName,
  userColor: providedUserColor,
  initialMarkdown = '',
  onChange,
  readOnly = false,
}: CollaborativeEditorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<CollaborativeUser[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const userColor = useMemo(
    () => providedUserColor || generateUserColor(userId),
    [providedUserColor, userId]
  );

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Doc>) => {
      let doc = yjsDocMap.get(id);
      if (!doc) {
        doc = new Doc();
        yjsDocMap.set(id, doc);
      }

      const provider = new WebsocketProvider(WEBSOCKET_URL, id, doc, {
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

      return provider as unknown as Provider;
    },
    [userId, userName, userColor]
  );

  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
      }
    };
  }, []);

  const handleExport = useCallback(
    (markdown: string) => {
      onChange?.(markdown);
    },
    [onChange]
  );

  const initialConfig = useMemo(
    () => ({
      namespace: 'CollaborativeEditor',
      theme: lexicalTheme,
      nodes: [...lexicalNodes, AuthorHighlightNode, CommentMarkNode],
      editorState: null,
      onError: (error: Error) => {
        console.error('[Lexical] Editor error:', error);
      },
      editable: !readOnly,
    }),
    [readOnly]
  );

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <CollaborationStatus
          isConnected={isConnected}
          usersCount={users.length}
          error={error}
        />
      </div>

      <CursorOverlay users={users} />

      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-editor prose prose-sm max-w-none min-h-[400px] p-5 focus:outline-none"
                aria-placeholder={editorPlaceholder}
                placeholder={<Placeholder />}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          <CollaborationPlugin
            id={documentId}
            providerFactory={providerFactory}
            shouldBootstrap={!!initialMarkdown}
            username={userName}
            cursorColor={userColor}
          />

          <HistoryPlugin />
          <ListPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />

          {onChange && <MarkdownExportPlugin onExport={handleExport} />}
        </div>
      </LexicalComposer>
    </div>
  );
}

export default CollaborativeEditor;
