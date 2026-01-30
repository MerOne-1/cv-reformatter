'use client';

import { useMemo, useState } from 'react';
import { Brand } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { X, FileText, Columns, Eye, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CVPreviewModalProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
  brand: Brand;
  originalCvId?: string;
  originalFilename?: string;
}

export function CVPreviewModal({
  open,
  onClose,
  markdown,
  brand,
  originalCvId,
  originalFilename,
}: CVPreviewModalProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const brandColors = useMemo(() => {
    return brand === 'DREAMIT'
      ? { primary: '#3b82f6', secondary: '#60a5fa', name: 'DreamIT', class: 'dreamit' }
      : { primary: '#a855f7', secondary: '#c084fc', name: 'Rupturae', class: 'rupturae' };
  }, [brand]);

  const html = useMemo(() => {
    if (!markdown) return '';

    let content = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /^### (.+)$/gm,
        `<h3 style="color: #64748b; font-size: 0.8rem; font-weight: 600; margin: 1.25rem 0 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">$1</h3>`
      )
      .replace(
        /^## (.+)$/gm,
        `<h2 style="color: #0f172a; font-size: 1.1rem; font-weight: 600; margin: 1.75rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid ${brandColors.primary}30;">$1</h2>`
      )
      .replace(
        /^# (.+)$/gm,
        `<h1 style="color: ${brandColors.primary}; font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; font-family: 'Sora', system-ui, sans-serif;">$1</h1>`
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1e293b;">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em style="color: #64748b;">$1</em>')
      .replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />')
      .replace(/^- (.+)$/gm, `<li style="position: relative; margin-left: 1rem; padding-left: 1rem; margin-bottom: 0.35rem; font-size: 0.875rem; color: #475569;"><span style="position: absolute; left: 0; top: 0.5em; width: 5px; height: 5px; border-radius: 50%; background: ${brandColors.primary}40;"></span>$1</li>`)
      .replace(
        /\[À compléter\]/gi,
        `<span style="background: #fef3c7; color: #92400e; padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; border: 1px solid #fcd34d;">A completer</span>`
      )
      .replace(
        /##INFO MANQUANTE##\s*\[([^\]]+)\]/g,
        `<span style="background: #fef3c7; color: #92400e; padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; border: 1px dashed #f59e0b;">$1</span>`
      )
      .replace(/^(?!<[hlu]|<hr|<li|<span)(.+)$/gm, '<p style="margin: 0.4rem 0; font-size: 0.875rem; line-height: 1.6; color: #475569;">$1</p>');

    content = content.replace(
      /(<li[^>]*>.*?<\/li>\n?)+/g,
      (match) => `<ul style="list-style-type: none; margin: 0.75rem 0; padding-left: 0;">${match}</ul>`
    );

    return content;
  }, [markdown, brandColors]);

  if (!open) return null;

  const isPdf = originalFilename?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[95vw] h-[92vh] bg-card rounded-3xl shadow-elevated flex flex-col overflow-hidden animate-scale-in border border-border">
        {/* Header */}
        <div className="flex-shrink-0 h-16 border-b border-border flex items-center justify-between px-5 bg-background-elevated">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              brand === 'DREAMIT' ? 'gradient-dreamit' : 'gradient-rupturae'
            )}>
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium">Apercu du CV</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Format {brandColors.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {originalCvId && isPdf && (
              <Button
                variant={showOriginal ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowOriginal(!showOriginal)}
              >
                <Columns className="w-4 h-4" />
                {showOriginal ? 'Masquer original' : 'Comparer'}
              </Button>
            )}
            <div className="w-px h-6 bg-border" />
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden bg-background">
          {/* Original PDF (if showing) */}
          {showOriginal && originalCvId && (
            <div className="w-1/2 border-r border-border bg-card overflow-hidden">
              <div className="h-full p-4">
                <div className="h-full bg-white rounded-2xl shadow-soft overflow-hidden border border-border">
                  <iframe
                    src={`/api/cv/preview/${originalCvId}#toolbar=0`}
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className={cn('flex-1 overflow-auto p-6 scrollbar-minimal', showOriginal && 'w-1/2')}>
            <div
              className="max-w-3xl mx-auto bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden"
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              {/* Brand header bar */}
              <div
                className="h-2"
                style={{ background: `linear-gradient(90deg, ${brandColors.primary}, ${brandColors.secondary})` }}
              />

              <div className="p-8">
                {/* Brand logo area */}
                <div className="flex items-center justify-between mb-8 pb-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                      style={{ background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})` }}
                    >
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm" style={{ color: brandColors.primary }}>
                        {brandColors.name}
                      </span>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Consulting</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    CV Consultant
                  </span>
                </div>

                {/* Content */}
                <div dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
