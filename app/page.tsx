'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CVList } from '@/components/cv-list';
import { CVPreviewModal } from '@/components/cv-preview-modal';
import { CVListItem, CVWithImprovements, Brand } from '@/lib/types';
import { BrandSelector } from '@/components/brand-selector';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  FileText,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Upload,
  FileSearch,
  Loader2,
  Columns,
  X,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const [selectedCV, setSelectedCV] = useState<CVWithImprovements | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [brand, setBrand] = useState<Brand>('DREAMIT');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'formatted'>('code');

  useEffect(() => {
    if (selectedCV) {
      setMarkdown(selectedCV.markdownContent || '');
      setBrand(selectedCV.brand);
    }
  }, [selectedCV]);

  // Auto-save on markdown change (debounced)
  useEffect(() => {
    if (!selectedCV || !markdown || markdown === selectedCV.markdownContent) return;

    const timer = setTimeout(() => {
      fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdown, brand }),
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [markdown, brand, selectedCV]);

  const handleSelectCV = useCallback(async (cvItem: CVListItem) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cv/${cvItem.id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedCV(data.data);
      }
    } catch (error) {
      console.error('Error loading CV:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleExtract = async () => {
    if (!selectedCV) return;
    try {
      setExtracting(true);
      const response = await fetch('/api/cv/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id }),
      });
      const data = await response.json();
      if (data.success) {
        setMarkdown(data.data.markdownContent);
        setSelectedCV({ ...selectedCV, ...data.data });
        handleRefresh();
      }
    } catch (error) {
      console.error('Error extracting:', error);
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCV) return;
    try {
      setGenerating(true);
      // Save first
      await fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdown, brand }),
      });

      const response = await fetch('/api/cv/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id, brand }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'cv.docx';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadFinal = async () => {
    if (!selectedCV) return;
    try {
      setUploading(true);
      // Save first
      await fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdown, brand }),
      });

      const response = await fetch('/api/cv/upload-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id, brand }),
      });
      const data = await response.json();
      if (data.success) {
        handleRefresh();
      }
    } catch (error) {
      console.error('Error uploading:', error);
    } finally {
      setUploading(false);
    }
  };

  const hasContent = markdown && markdown.trim().length > 0;

  // Convert markdown to HTML for formatted view
  const formattedHtml = useMemo(() => {
    if (!markdown) return '';

    let content = markdown
      // Remove markdown code block wrappers
      .replace(/^```markdown\s*\n?/gm, '')
      .replace(/^```\s*$/gm, '');

    // Extract and format the blockquote section (missing info)
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
        // Remove the blockquote from content
        content = content.replace(blockquoteMatch[0], '');
      }
    }

    content = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings
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
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em class="italic text-muted-foreground">$1</em>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr class="my-6 border-border" />')
      // List items
      .replace(/^- (.+)$/gm, '<li class="pl-4 mb-1.5 text-sm text-muted-foreground relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-dreamit/40">$1</li>')
      // [À compléter] placeholders
      .replace(
        /\[À compléter\]/gi,
        '<span class="inline-flex items-center gap-1 bg-warning/15 text-warning px-2 py-0.5 rounded-md text-xs font-medium border border-warning/20">À compléter</span>'
      )
      // Legacy missing info markers
      .replace(
        /##INFO MANQUANTE##\s*\[([^\]]+)\]/g,
        '<span class="inline-flex items-center gap-1 bg-warning/15 text-warning px-2 py-0.5 rounded-md text-xs font-medium border border-dashed border-warning/30">$1</span>'
      )
      // Paragraphs
      .replace(/^(?!<[hlu]|<hr|<li|<span|<div)(.+)$/gm, '<p class="my-2 text-sm text-muted-foreground leading-relaxed">$1</p>');

    // Wrap consecutive li elements in ul
    content = content.replace(
      /(<li[^>]*>.*?<\/li>\n?)+/g,
      (match) => `<ul class="list-none my-3 space-y-1">${match}</ul>`
    );

    return blockquoteHtml + content;
  }, [markdown]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-border flex items-center justify-between px-4 bg-background-elevated relative">
        {/* Accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-dreamit/50 to-transparent" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-dreamit flex items-center justify-center shadow-lg shadow-dreamit/20">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold tracking-tight">CV Reformatter</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/settings">
            <Button variant="ghost" size="icon-sm">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Sidebar */}
        <div
          className={cn(
            'flex-shrink-0 border-r border-border bg-background-elevated transition-all duration-300 ease-out-expo overflow-hidden',
            sidebarCollapsed ? 'w-0 border-r-0' : 'w-80'
          )}
        >
          <div className="h-full w-80">
            <CVList
              key={refreshKey}
              onSelectCV={handleSelectCV}
              selectedId={selectedCV?.id}
              onRefresh={handleRefresh}
              onDelete={(id) => {
                if (selectedCV?.id === id) {
                  setSelectedCV(null);
                  setMarkdown('');
                }
              }}
              compact
            />
          </div>
        </div>

        {/* Floating toggle button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 z-20 w-5 h-12 bg-card border border-border shadow-soft rounded-r-lg flex items-center justify-center hover:bg-card-hover transition-all duration-300 ease-out-expo group',
            sidebarCollapsed ? 'left-0' : 'left-80'
          )}
          title={sidebarCollapsed ? 'Ouvrir la liste' : 'Fermer la liste'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </button>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Chargement...</p>
              </div>
            </div>
          ) : selectedCV ? (
            <>
              {/* Toolbar */}
              <div className="flex-shrink-0 h-14 border-b border-border flex items-center justify-between px-5 bg-background-elevated">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      brand === 'DREAMIT' ? 'bg-dreamit shadow-sm shadow-dreamit/50' : 'bg-rupturae shadow-sm shadow-rupturae/50'
                    )} />
                    <span className="font-medium text-sm truncate max-w-[280px]">
                      {selectedCV.consultantName || selectedCV.originalName}
                    </span>
                  </div>
                  <div className="h-5 w-px bg-border" />
                  <BrandSelector value={brand} onChange={setBrand} />
                </div>

                <div className="flex items-center gap-2">
                  {!hasContent ? (
                    <Button
                      size="sm"
                      onClick={handleExtract}
                      disabled={extracting}
                      variant={brand === 'DREAMIT' ? 'dreamit' : 'rupturae'}
                    >
                      {extracting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileSearch className="w-4 h-4" />
                      )}
                      Extraire le contenu
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant={showOriginal ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setShowOriginal(!showOriginal)}
                      >
                        {showOriginal ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Columns className="w-4 h-4" />
                        )}
                        {showOriginal ? 'Fermer' : 'Original'}
                      </Button>
                      <Button
                        variant={viewMode === 'formatted' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode(viewMode === 'code' ? 'formatted' : 'code')}
                      >
                        {viewMode === 'code' ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <Code2 className="w-4 h-4" />
                        )}
                        {viewMode === 'code' ? 'Aperçu' : 'Code'}
                      </Button>
                      <div className="h-5 w-px bg-border" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={generating}
                      >
                        {generating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        DOCX
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleUploadFinal}
                        disabled={uploading}
                        variant={brand === 'DREAMIT' ? 'dreamit' : 'rupturae'}
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        Finaliser
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor - Simple Textarea with optional split view */}
              <div className="flex-1 overflow-hidden flex">
                {/* Original CV Panel (when showOriginal is true) */}
                {showOriginal && selectedCV && (
                  <div className="w-1/2 border-r border-border bg-card flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 h-11 border-b border-border bg-background-elevated flex items-center px-4">
                      <FileText className="w-4 h-4 text-muted-foreground mr-2" />
                      <span className="text-sm font-medium truncate text-muted-foreground">
                        {selectedCV.originalName}
                      </span>
                    </div>
                    <div className="flex-1 overflow-hidden p-3">
                      {selectedCV.originalName.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={`/api/cv/preview/${selectedCV.id}#toolbar=0&navpanes=0`}
                          className="w-full h-full border-0 rounded-xl bg-white"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-secondary/30 rounded-xl border border-border">
                          <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                          <p className="text-sm text-muted-foreground mb-3">
                            Aperçu non disponible pour les fichiers DOCX
                          </p>
                          <a
                            href={`/api/cv/preview/${selectedCV.id}`}
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

                {/* Markdown Editor */}
                <div className={cn('flex-1 overflow-hidden', showOriginal && 'w-1/2')}>
                  {hasContent ? (
                    viewMode === 'code' ? (
                      <textarea
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
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
                      <h3 className="font-display text-xl font-medium mb-2">Pret pour l'extraction</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mb-6">
                        Cliquez sur &quot;Extraire le contenu&quot; pour analyser le CV avec l'IA
                      </p>
                      <Button
                        onClick={handleExtract}
                        disabled={extracting}
                        variant={brand === 'DREAMIT' ? 'dreamit' : 'rupturae'}
                        size="lg"
                      >
                        {extracting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Lancer l'extraction
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 max-w-md">
                <div className="w-20 h-20 rounded-3xl bg-secondary/50 border border-border flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-9 h-9 text-muted-foreground/50" />
                </div>
                <h3 className="font-display text-xl font-medium mb-2">Selectionnez un CV</h3>
                <p className="text-sm text-muted-foreground">
                  Choisissez un CV dans la liste ou uploadez-en un nouveau pour commencer
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <CVPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        markdown={markdown}
        brand={brand}
        originalCvId={selectedCV?.id}
        originalFilename={selectedCV?.originalName}
      />
    </div>
  );
}
