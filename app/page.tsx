'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CVPreviewModal } from '@/components/features/cv/cv-preview-modal';
import { CVHeader } from '@/components/features/cv/CVHeader';
import { CVSidebar } from '@/components/features/cv/CVSidebar';
import { CVToolbar } from '@/components/features/cv/CVToolbar';
import { CVEditorPanel } from '@/components/features/cv/CVEditorPanel';
import { CVListItem, CVWithImprovements, Brand } from '@/lib/types';
import { useDebouncedSave } from '@/hooks';
import { FileText, Loader2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
}

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
  const [templates, setTemplates] = useState<Template[]>([]);

  // Fetch templates on mount
  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTemplates(data.data);
        }
      })
      .catch(console.error);
  }, []);

  // Get current template based on brand
  const currentTemplate = useMemo(() => {
    return templates.find(t => t.name === brand) || null;
  }, [templates, brand]);

  useEffect(() => {
    if (selectedCV) {
      setMarkdown(selectedCV.markdownContent || '');
      setBrand(selectedCV.brand);
    }
  }, [selectedCV]);

  // Auto-save callback - stable reference using selectedCV.id
  const handleAutoSave = useCallback(
    async (data: { markdown: string; brand: Brand }) => {
      if (!selectedCV) return;
      await fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: data.markdown, brand: data.brand }),
      });
    },
    [selectedCV]
  );

  // Memoized save data to avoid unnecessary re-renders
  const saveData = useMemo(
    () => ({ markdown, brand }),
    [markdown, brand]
  );

  // Auto-save with debounce - replaces inline useEffect
  const { isSaving: isAutoSaving, error: saveError } = useDebouncedSave({
    value: saveData,
    onSave: handleAutoSave,
    delay: 1500,
    enabled: !!selectedCV && !!markdown && markdown !== selectedCV.markdownContent,
  });

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

  const hasContent = Boolean(markdown && markdown.trim().length > 0);

  return (
    <div className="h-screen flex flex-col bg-background">
      <CVHeader />

      <div className="flex-1 flex overflow-hidden relative">
        <CVSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onSelectCV={handleSelectCV}
          selectedId={selectedCV?.id}
          onRefresh={handleRefresh}
          onDelete={(id) => {
            if (selectedCV?.id === id) {
              setSelectedCV(null);
              setMarkdown('');
            }
          }}
          refreshKey={refreshKey}
        />

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
              <CVToolbar
                cv={selectedCV}
                brand={brand}
                onBrandChange={setBrand}
                hasContent={hasContent}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showOriginal={showOriginal}
                onToggleOriginal={() => setShowOriginal(!showOriginal)}
                onExtract={handleExtract}
                onGenerate={handleGenerate}
                onUploadFinal={handleUploadFinal}
                onPreview={() => setPreviewOpen(true)}
                extracting={extracting}
                generating={generating}
                uploading={uploading}
              />
              <CVEditorPanel
                cv={selectedCV}
                markdown={markdown}
                onChange={setMarkdown}
                viewMode={viewMode}
                showOriginal={showOriginal}
                brand={brand}
                onExtract={handleExtract}
                extracting={extracting}
              />
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

      <CVPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        markdown={markdown}
        brand={brand}
        originalCvId={selectedCV?.id}
        originalFilename={selectedCV?.originalName}
        logoUrl={currentTemplate?.logoUrl}
        website={currentTemplate?.website}
        consultantName={selectedCV?.consultantName || ''}
      />
    </div>
  );
}
