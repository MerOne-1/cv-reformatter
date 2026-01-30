'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ZoomIn, ZoomOut, Loader2, ExternalLink, Maximize2 } from 'lucide-react';

interface OriginalPreviewProps {
  cvId: string;
  filename: string;
}

export function OriginalPreview({ cvId, filename }: OriginalPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const previewUrl = `/api/cv/preview/${cvId}`;

  const handleZoomIn = () => setZoom(Math.min(zoom + 25, 200));
  const handleZoomOut = () => setZoom(Math.max(zoom - 25, 50));

  const openInNewTab = () => {
    window.open(previewUrl, '_blank');
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">CV Original</CardTitle>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {filename}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={openInNewTab}
            title="Ouvrir dans un nouvel onglet"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0 bg-secondary/30">
        {isPdf ? (
          <div className="relative w-full h-full">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 z-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {error ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Impossible de charger l&apos;aperçu
                </p>
                <Button variant="outline" size="sm" onClick={openInNewTab}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ouvrir le fichier
                </Button>
              </div>
            ) : (
              <iframe
                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top left',
                  width: `${10000 / zoom}%`,
                  height: `${10000 / zoom}%`,
                }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">
              Aperçu non disponible pour les fichiers DOCX
            </p>
            <Button variant="outline" size="sm" onClick={openInNewTab}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Télécharger le fichier
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
