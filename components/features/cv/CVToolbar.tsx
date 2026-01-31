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
import { TemplateSelector } from '@/components/layout/template-selector';
import { CVWithImprovements } from '@/lib/types';

interface CVToolbarProps {
  cv: CVWithImprovements;
  templateName: string;
  onTemplateChange: (templateName: string) => void;
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
  templateName,
  onTemplateChange,
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
          <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
          <span className="font-medium text-sm truncate max-w-[280px]">
            {cv.consultantName || cv.originalName}
          </span>
        </div>
        <div className="h-5 w-px bg-border" />
        <TemplateSelector value={templateName} onChange={onTemplateChange} />
      </div>

      <div className="flex items-center gap-2">
        {!hasContent ? (
          <Button
            size="sm"
            onClick={onExtract}
            disabled={extracting}
            variant="default"
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
              size="icon"
              className="h-8 w-8"
              onClick={onToggleOriginal}
              title={showOriginal ? 'Fermer l\'original' : 'Voir l\'original'}
            >
              {showOriginal ? (
                <X className="w-4 h-4" />
              ) : (
                <Columns className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onExtract}
              disabled={extracting}
              title="Régénérer l'extraction IA"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
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
              variant="default"
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
