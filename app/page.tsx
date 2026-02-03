'use client';

import { useCallback } from 'react';
import { CVPreviewModal } from '@/components/features/cv/cv-preview-modal';
import { CVHeader } from '@/components/features/cv/CVHeader';
import { CVSidebar } from '@/components/features/cv/CVSidebar';
import { CVToolbar } from '@/components/features/cv/CVToolbar';
import { CVEditorPanel } from '@/components/features/cv/CVEditorPanel';
import { CVListItem } from '@/lib/types';
import { FileText, Loader2 } from 'lucide-react';

// Stores
import { useCVStore, useUIStore } from '@/lib/stores';

// Queries
import { useCVList, useTemplates } from '@/lib/queries';

// Hooks
import { useCVActions, useAutoSave, useWorkflow } from '@/lib/hooks';

export default function Home() {
  // === STORES ===
  const {
    selectedCV,
    markdown,
    templateName,
    selectCV,
    setMarkdown,
    setTemplateName,
    reset: resetCVStore,
  } = useCVStore();

  const {
    sidebarCollapsed,
    toggleSidebar,
    viewMode,
    setViewMode,
    previewModalOpen,
    setPreviewModalOpen,
  } = useUIStore();

  // === QUERIES ===
  const { refetch: refetchCVList } = useCVList();
  const { data: templates = [] } = useTemplates();

  // Get current template (filter active templates for display)
  const activeTemplates = templates.filter((t) => t.isActive);
  const currentTemplate = templates.find((t) => t.name === templateName) ?? null;

  // === HOOKS ===
  const {
    extract,
    generate,
    uploadFinal,
    saveNotes,
    refreshAudioNotes,
    extracting,
    generating,
    uploading,
  } = useCVActions();

  useAutoSave({ enabled: !!selectedCV });

  const handleWorkflowComplete = useCallback(() => {
    refetchCVList();
  }, [refetchCVList]);

  const handleWorkflowError = useCallback((error: Error) => {
    console.error('Workflow error:', error);
    alert(error.message);
  }, []);

  const { start: startWorkflow, isRunning: runningWorkflow, progress: workflowProgress } = useWorkflow({
    onComplete: handleWorkflowComplete,
    onError: handleWorkflowError,
  });

  // === HANDLERS ===
  const handleSelectCV = useCallback(
    async (cvItem: CVListItem) => {
      try {
        const response = await fetch(`/api/cv/${cvItem.id}`);
        const data = await response.json();
        if (data.success) {
          selectCV(data.data);
        }
      } catch (error) {
        console.error('Error loading CV:', error);
      }
    },
    [selectCV]
  );

  const handleDeleteCV = useCallback(
    (deletedId: string) => {
      if (selectedCV?.id === deletedId) {
        resetCVStore();
      }
      refetchCVList();
    },
    [selectedCV?.id, resetCVStore, refetchCVList]
  );

  const handleNotesChange = useCallback(
    async (notes: string | null, futureMissionNotes: string | null) => {
      await saveNotes(notes, futureMissionNotes);
    },
    [saveNotes]
  );

  const hasContent = Boolean(markdown && markdown.trim().length > 0);

  // === RENDER ===
  return (
    <div className="h-screen flex flex-col bg-background">
      <CVHeader />

      <div className="flex-1 flex overflow-hidden relative">
        <CVSidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          onSelectCV={handleSelectCV}
          selectedId={selectedCV?.id}
          onRefresh={refetchCVList}
          onDelete={handleDeleteCV}
          refreshKey={0}
        />

        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {selectedCV ? (
            <>
              <CVToolbar
                cv={selectedCV}
                templateName={templateName}
                onTemplateChange={setTemplateName}
                hasContent={hasContent}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showOriginal={false}
                onToggleOriginal={() => {}}
                onExtract={extract}
                onRunWorkflow={startWorkflow}
                onGenerate={generate}
                onUploadFinal={uploadFinal}
                onPreview={() => setPreviewModalOpen(true)}
                extracting={extracting}
                runningWorkflow={runningWorkflow}
                workflowProgress={workflowProgress?.progress ?? null}
                generating={generating}
                uploading={uploading}
                notes={selectedCV.notes ?? null}
                futureMissionNotes={selectedCV.futureMissionNotes ?? null}
                onNotesChange={handleNotesChange}
                audioNotes={selectedCV.audioNotes ?? []}
                onAudioNotesChange={refreshAudioNotes}
              />
              <CVEditorPanel
                cv={selectedCV}
                markdown={markdown}
                onChange={setMarkdown}
                viewMode={viewMode}
                showOriginal={false}
                templateName={templateName}
                onExtract={extract}
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
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        markdown={markdown}
        templateName={templateName}
        template={currentTemplate}
        originalCvId={selectedCV?.id}
        originalFilename={selectedCV?.originalName}
        logoUrl={currentTemplate?.logoUrl || currentTemplate?.logoHeaderUrl}
        website={currentTemplate?.website}
        consultantName={selectedCV?.consultantName || ''}
      />
    </div>
  );
}
