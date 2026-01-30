import { ParsedSection } from './types';

export function parseMarkdown(markdown: string): ParsedSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      sections.push({ type: 'list', content: '', items: [...currentList] });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      continue;
    }

    if (trimmed === '---') {
      flushList();
      sections.push({ type: 'separator', content: '' });
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      sections.push({ type: 'heading1', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('## ')) {
      flushList();
      sections.push({ type: 'heading2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('### ')) {
      flushList();
      sections.push({ type: 'heading3', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
    } else if (trimmed.startsWith('**') && trimmed.includes(':**')) {
      flushList();
      const match = trimmed.match(/\*\*([^*]+):\*\*\s*(.+)/);
      if (match) {
        sections.push({
          type: 'paragraph',
          content: trimmed,
          metadata: { [match[1]]: match[2] },
        });
      } else {
        sections.push({ type: 'paragraph', content: trimmed });
      }
    } else {
      flushList();
      sections.push({ type: 'paragraph', content: trimmed });
    }
  }

  flushList();
  return sections;
}
