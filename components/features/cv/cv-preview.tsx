'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brand } from '@/lib/types';
import { Eye, FileText } from 'lucide-react';

interface CVPreviewProps {
  markdown: string;
  brand: Brand;
}

export function CVPreview({ markdown, brand }: CVPreviewProps) {
  const brandColors = useMemo(() => {
    return brand === 'DREAMIT'
      ? { primary: '#1E3A8A', secondary: '#3B82F6', name: 'DreamIT' }
      : { primary: '#7C3AED', secondary: '#A78BFA', name: 'Rupturae' };
  }, [brand]);

  const html = useMemo(() => {
    if (!markdown) return '';

    let content = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings
      .replace(
        /^### (.+)$/gm,
        `<h3 style="color: ${brandColors.secondary}; font-size: 0.875rem; font-weight: 600; margin: 1rem 0 0.5rem; font-family: 'DM Sans', sans-serif; letter-spacing: -0.01em;">$1</h3>`
      )
      .replace(
        /^## (.+)$/gm,
        `<h2 style="color: ${brandColors.primary}; font-size: 1.125rem; font-weight: 400; margin: 1.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid ${brandColors.secondary}20; font-family: 'Instrument Serif', Georgia, serif; letter-spacing: -0.02em;">$1</h2>`
      )
      .replace(
        /^# (.+)$/gm,
        `<h1 style="color: ${brandColors.primary}; font-size: 1.5rem; font-weight: 400; text-align: center; margin-bottom: 0.25rem; font-family: 'Instrument Serif', Georgia, serif; letter-spacing: -0.02em;">$1</h1>`
      )
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0;" />')
      // List items
      .replace(/^- (.+)$/gm, '<li style="margin-left: 1rem; padding-left: 0.5rem; margin-bottom: 0.25rem; font-size: 0.875rem; line-height: 1.5;">$1</li>')
      // Missing info markers
      .replace(
        /##INFO MANQUANTE##\s*\[([^\]]+)\]/g,
        `<span style="background: #fef3c7; color: #92400e; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-weight: 500; font-size: 0.75rem; border: 1px dashed #f59e0b;">⚠ $1</span>`
      )
      // Paragraphs
      .replace(/^(?!<[hlu]|<hr|<li|<span)(.+)$/gm, '<p style="margin: 0.375rem 0; font-size: 0.875rem; line-height: 1.6;">$1</p>');

    // Wrap consecutive li elements in ul
    content = content.replace(
      /(<li[^>]*>.*?<\/li>\n?)+/g,
      (match) => `<ul style="list-style-type: disc; margin: 0.5rem 0; padding-left: 1rem;">${match}</ul>`
    );

    return content;
  }, [markdown, brandColors]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Aperçu</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Template {brandColors.name}
            </p>
          </div>
        </div>
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})` }}
        />
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4 scrollbar-thin bg-secondary/20">
        {markdown ? (
          <div
            className="bg-white rounded-xl shadow-sm border p-8 min-h-full"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            {/* Brand header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: `${brandColors.primary}20` }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})` }}
                >
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-sm" style={{ color: brandColors.primary }}>
                  {brandColors.name}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                CV Consultant
              </span>
            </div>

            {/* CV Content */}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Eye className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">
              L&apos;aperçu apparaîtra ici après l&apos;extraction
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
