'use client';

import {
  Eye,
  Download,
  Upload,
  FileSearch,
  Loader2,
  Columns,
  X,
  Code2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandSelector } from '@/components/layout/brand-selector';
import { Brand, CVWithImprovements } from '@/lib/types';

interface CVToolbarProps {
  cv: CVWithImprovements;
  brand: Brand;
  onBrandChange: (brand: Brand) => void;
  hasContent: boolean;
  viewMode: 'code' | 'formatted';
  onViewModeChange: (mode: 'code' | 'formatted') => void;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onExtract: () => void;
  onGenerate: () => void;
  onUploadFinal: () => void;
  onPreview: () => void;
  extracting: boolean;
  generating: boolean;
  uploading: boolean;
}

export function CVToolbar({
  cv,
  brand,
  onBrandChange,
  hasContent,
  viewMode,
  onViewModeChange,
  showOriginal,
  onToggleOriginal,
  onExtract,
  onGenerate,
  onUploadFinal,
  onPreview,
  extracting,
  generating,
  uploading,
}: CVToolbarProps) {
  return (
    <div className="flex-shrink-0 h-14 border-b border-border flex items-center justify-between px-5 bg-background-elevated">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-2 h-2 rounded-full',
            brand === 'DREAMIT' ? 'bg-dreamit shadow-sm shadow-dreamit/50' : 'bg-rupturae shadow-sm shadow-rupturae/50'
          )} />
          <span className="font-medium text-sm truncate max-w-[280px]">
            {cv.consultantName || cv.originalName}
          </span>
        </div>
        <div className="h-5 w-px bg-border" />
        <BrandSelector value={brand} onChange={onBrandChange} />
      </div>

      <div className="flex items-center gap-2">
        {!hasContent ? (
          <Button
            size="sm"
            onClick={onExtract}
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
              onClick={onToggleOriginal}
            >
              {showOriginal ? (
                <X className="w-4 h-4" />
              ) : (
                <Columns className="w-4 h-4" />
              )}
              {showOriginal ? 'Fermer' : 'Original'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExtract}
              disabled={extracting}
              title="Régénérer l'extraction IA"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Régénérer
            </Button>
            <Button
              variant={viewMode === 'formatted' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange(viewMode === 'code' ? 'formatted' : 'code')}
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
              onClick={onPreview}
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
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
              onClick={onUploadFinal}
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
  );
}
