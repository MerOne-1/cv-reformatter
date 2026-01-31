'use client';

import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Columns, Eye, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    // Use proxy API to avoid CORS issues with external images
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return data.base64 || null;
  } catch {
    return null;
  }
}

function PDFLoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement du PDF...</p>
      </div>
    </div>
  );
}

interface TemplateInfo {
  id: string;
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
}

interface CVPreviewModalProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
  templateName: string;
  template?: TemplateInfo | null;
  originalCvId?: string;
  originalFilename?: string;
  logoUrl?: string | null;
  website?: string | null;
  consultantName?: string;
}

// Client-only PDF Viewer component
function ClientPDFViewer({
  markdown,
  brandName,
  brandColors,
  logoUrl,
  website,
  consultantName,
}: {
  markdown: string;
  brandName: string;
  brandColors: { primary: string; secondary: string };
  logoUrl?: string | null;
  website?: string | null;
  consultantName?: string;
}) {
  const [PDFComponents, setPDFComponents] = useState<{
    PDFViewer: React.ComponentType<{ width: string; height: string; showToolbar: boolean; style: React.CSSProperties; children: React.ReactNode }>;
    CVPdfDocument: React.ComponentType<{
      markdown: string;
      brandName: string;
      brandColors: { primary: string; secondary: string };
      logoUrl?: string | null;
      logoBase64?: string | null;
      website?: string | null;
      consultantName?: string;
    }>;
  } | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    // Only import on client side
    Promise.all([
      import('@react-pdf/renderer'),
      import('./cv-pdf-document'),
    ]).then(([pdfRenderer, pdfDoc]) => {
      setPDFComponents({
        PDFViewer: pdfRenderer.PDFViewer as unknown as typeof PDFComponents extends null ? never : NonNullable<typeof PDFComponents>['PDFViewer'],
        CVPdfDocument: pdfDoc.CVPdfDocument,
      });
    }).catch((error) => {
      console.error('Failed to load PDF components:', error);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (logoUrl) {
      fetchImageAsBase64(logoUrl).then((base64) => {
        if (!cancelled) setLogoBase64(base64);
      });
    } else {
      setLogoBase64(null);
    }
    return () => { cancelled = true; };
  }, [logoUrl]);

  if (!PDFComponents) {
    return <PDFLoadingState />;
  }

  const { PDFViewer, CVPdfDocument } = PDFComponents;

  return (
    <PDFViewer
      width="100%"
      height="100%"
      showToolbar={true}
      style={{ border: 'none' }}
    >
      <CVPdfDocument
        markdown={markdown}
        brandName={brandName}
        brandColors={brandColors}
        logoUrl={logoUrl}
        logoBase64={logoBase64}
        website={website}
        consultantName={consultantName}
      />
    </PDFViewer>
  );
}

export function CVPreviewModal({
  open,
  onClose,
  markdown,
  templateName,
  template,
  originalCvId,
  originalFilename,
  logoUrl,
  website,
  consultantName,
}: CVPreviewModalProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const brandColors = useMemo(() => {
    if (template) {
      return {
        primary: template.primaryColor,
        secondary: template.secondaryColor,
        name: template.displayName,
      };
    }
    // Fallback for legacy templates
    return templateName === 'DREAMIT'
      ? { primary: '#0C4A6E', secondary: '#0EA5E9', name: 'DreamIT' }
      : { primary: '#7C3AED', secondary: '#A78BFA', name: 'Rupturae' };
  }, [template, templateName]);

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
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`,
              }}
            >
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

          {/* PDF Preview */}
          <div className={cn('flex-1 overflow-hidden p-4', showOriginal && 'w-1/2')}>
            <div className="h-full bg-gray-100 rounded-2xl overflow-hidden border border-border">
              {isClient ? (
                <ClientPDFViewer
                  markdown={markdown}
                  brandName={brandColors.name}
                  brandColors={{ primary: brandColors.primary, secondary: brandColors.secondary }}
                  logoUrl={logoUrl}
                  website={website}
                  consultantName={consultantName}
                />
              ) : (
                <PDFLoadingState />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
