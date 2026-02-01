'use client';

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode, EditorState } from 'lexical';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';

const MARKDOWN_TRANSFORMERS = [...TRANSFORMERS];

interface MarkdownImportPluginProps {
  markdown: string;
}

export function MarkdownImportPlugin({ markdown }: MarkdownImportPluginProps) {
  const [editor] = useLexicalComposerContext();
  const hasImported = useRef(false);

  useEffect(() => {
    if (hasImported.current || !markdown) return;

    editor.update(() => {
      $convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS);
    });

    hasImported.current = true;
  }, [editor, markdown]);

  return null;
}

interface MarkdownExportPluginProps {
  onExport: (markdown: string) => void;
}

export function MarkdownExportPlugin({ onExport }: MarkdownExportPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString(MARKDOWN_TRANSFORMERS);
        onExport(markdown);
      });
    });
  }, [editor, onExport]);

  return null;
}

interface OnChangePluginProps {
  onChange: (editorState: EditorState) => void;
  debounceMs?: number;
}

export function OnChangePlugin({ onChange, debounceMs = 300 }: OnChangePluginProps) {
  const [editor] = useLexicalComposerContext();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onChange(editorState);
      }, debounceMs);
    });
  }, [editor, onChange, debounceMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return null;
}

export function ClearEditorPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      {
        type: 'clearEditor',
      } as never,
      () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(''));
          root.append(paragraph);
        });
        return true;
      },
      0
    );
  }, [editor]);

  return null;
}

export const lexicalNodes = [HeadingNode, QuoteNode, ListNode, ListItemNode];
