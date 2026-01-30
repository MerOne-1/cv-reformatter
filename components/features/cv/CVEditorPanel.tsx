'use client';

import { useMemo } from 'react';
import { FileText, FileSearch, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Brand, CVWithImprovements } from '@/lib/types';

interface CVEditorPanelProps {
  cv: CVWithImprovements;
  markdown: string;
  onChange: (markdown: string) => void;
  viewMode: 'code' | 'formatted';
  showOriginal: boolean;
  brand: Brand;
  onExtract: () => void;
  extracting: boolean;
}

export function CVEditorPanel({
  cv,
  markdown,
  onChange,
  viewMode,
  showOriginal,
  brand,
  onExtract,
  extracting,
}: CVEditorPanelProps) {
  const hasContent = markdown && markdown.trim().length > 0;

  const formattedHtml = useMemo(() => {
    if (!markdown) return '';

    let content = markdown
      .replace(/^```markdown\s*\n?/gm, '')
      .replace(/^```\s*$/gm, '');

    const blockquoteMatch = content.match(/^((?:>.*\n?)+)/m);
    let blockquoteHtml = '';
    if (blockquoteMatch) {
      const blockquoteContent = blockquoteMatch[1]
        .split('\n')
        .filter(line => line.startsWith('>'))
        .map(line => line.replace(/^>\s*/, ''))
        .join('\n');

      if (blockquoteContent.includes('Informations à compléter')) {
        const items = blockquoteContent
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => `<li class="text-sm">${line.replace(/^- /, '')}</li>`)
          .join('');

        if (items) {
          blockquoteHtml = `<div class="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-5 h-5 rounded-md bg-warning/20 flex items-center justify-center text-warning text-xs">!</span>
              <strong class="text-warning font-semibold text-sm">Informations manquantes</strong>
            </div>
            <ul class="list-none space-y-1.5 text-warning/90">${items}</ul>
          </div>`;
        }
        content = content.replace(blockquoteMatch[0], '');
      }
    }

    content = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /^### (.+)$/gm,
        '<h3 class="text-sm font-semibold text-muted-foreground mt-5 mb-2 uppercase tracking-wider">$1</h3>'
      )
      .replace(
        /^## (.+)$/gm,
        '<h2 class="font-display text-lg font-medium text-foreground mt-8 mb-3 pb-2 border-b border-border">$1</h2>'
      )
      .replace(
        /^# (.+)$/gm,
        '<h1 class="font-display text-2xl font-medium text-dreamit mb-6">$1</h1>'
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-muted-foreground">$1</em>')
      .replace(/^---$/gm, '<hr class="my-6 border-border" />')
      .replace(/^- (.+)$/gm, '<li class="pl-4 mb-1.5 text-sm text-muted-foreground relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-dreamit/40">$1</li>')
      .replace(
        /\[À compléter\]/gi,
        '<span class="inline-flex items-center gap-1 bg-warning/15 text-warning px-2 py-0.5 rounded-md text-xs font-medium border border-warning/20">À compléter</span>'
      )
      .replace(
        /##INFO MANQUANTE##\s*\[([^\]]+)\]/g,
        '<span class="inline-flex items-center gap-1 bg-warning/15 text-warning px-2 py-0.5 rounded-md text-xs font-medium border border-dashed border-warning/30">$1</span>'
      )
      .replace(/^(?!<[hlu]|<hr|<li|<span|<div)(.+)$/gm, '<p class="my-2 text-sm text-muted-foreground leading-relaxed">$1</p>');

    content = content.replace(
      /(<li[^>]*>.*?<\/li>\n?)+/g,
      (match) => `<ul class="list-none my-3 space-y-1">${match}</ul>`
    );

    return blockquoteHtml + content;
  }, [markdown]);

  return (
    <div className="flex-1 overflow-hidden flex">
      {showOriginal && cv && (
        <div className="w-1/2 border-r border-border bg-card flex flex-col overflow-hidden">
          <div className="flex-shrink-0 h-11 border-b border-border bg-background-elevated flex items-center px-4">
            <FileText className="w-4 h-4 text-muted-foreground mr-2" />
            <span className="text-sm font-medium truncate text-muted-foreground">
              {cv.originalName}
            </span>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            {cv.originalName.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={`/api/cv/preview/${cv.id}#toolbar=0&navpanes=0`}
                className="w-full h-full border-0 rounded-xl bg-white"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-secondary/30 rounded-xl border border-border">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground mb-3">
                  Aperçu non disponible pour les fichiers DOCX
                </p>
                <a
                  href={`/api/cv/preview/${cv.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-dreamit hover:underline"
                >
                  Telecharger le fichier
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={cn('flex-1 overflow-hidden', showOriginal && 'w-1/2')}>
        {hasContent ? (
          viewMode === 'code' ? (
            <textarea
              value={markdown}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full p-6 font-mono text-sm leading-relaxed resize-none focus:outline-none bg-card text-foreground placeholder:text-muted-foreground/50 scrollbar-minimal"
              spellCheck={false}
              placeholder="Contenu Markdown du CV..."
            />
          ) : (
            <div className="w-full h-full overflow-auto p-6 bg-background scrollbar-minimal">
              <div
                className="max-w-3xl mx-auto bg-card rounded-2xl border border-border p-8 shadow-soft"
                dangerouslySetInnerHTML={{ __html: formattedHtml }}
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-secondary/50 border border-border flex items-center justify-center mb-6">
              <FileSearch className="w-9 h-9 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-medium mb-2">Pret pour l&apos;extraction</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Cliquez sur &quot;Extraire le contenu&quot; pour analyser le CV avec l&apos;IA
            </p>
            <Button
              onClick={onExtract}
              disabled={extracting}
              variant={brand === 'DREAMIT' ? 'dreamit' : 'rupturae'}
              size="lg"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Lancer l&apos;extraction
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
