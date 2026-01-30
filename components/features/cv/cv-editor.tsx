'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandSelector } from '@/components/layout/brand-selector';
import { MissingInfoAlert } from '@/components/layout/missing-info-alert';
import { AgentButtons } from '@/components/features/agents/agent-buttons';
import { WorkflowSteps } from '@/components/features/workflow/workflow-steps';
import { CVWithImprovements, CVStatus, Brand } from '@/lib/types';
import {
  Save,
  FileSearch,
  Download,
  Upload,
  Loader2,
  Eye,
  Code2,
  Wand2,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

const MDXEditorComponent = dynamic(
  () => import('@mdxeditor/editor').then((mod) => {
    const { MDXEditor, headingsPlugin, listsPlugin, markdownShortcutPlugin, thematicBreakPlugin, quotePlugin } = mod;
    return function Editor({ markdown, onChange }: { markdown: string; onChange: (md: string) => void }) {
      return (
        <MDXEditor
          markdown={markdown}
          onChange={onChange}
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            markdownShortcutPlugin(),
            thematicBreakPlugin(),
            quotePlugin(),
          ]}
          contentEditableClassName="prose prose-sm max-w-none min-h-[400px] p-5 focus:outline-none"
        />
      );
    };
  }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px] bg-secondary/30 rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Chargement de l&apos;éditeur...</span>
        </div>
      </div>
    ),
  }
);

interface CVEditorProps {
  cv: CVWithImprovements;
  onUpdate: () => void;
}

export function CVEditor({ cv, onUpdate }: CVEditorProps) {
  const [markdown, setMarkdown] = useState(cv.markdownContent || '');
  const [brand, setBrand] = useState<Brand>(cv.brand);
  const [missingFields, setMissingFields] = useState<string[]>(cv.missingFields);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'source'>('editor');
  const [showAgents, setShowAgents] = useState(false);

  useEffect(() => {
    setMarkdown(cv.markdownContent || '');
    setBrand(cv.brand);
    setMissingFields(cv.missingFields);
  }, [cv]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/cv/${cv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdownContent: markdown,
          brand,
          status: 'EDITING' as CVStatus,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setMissingFields(data.data.missingFields);
      onUpdate();
    } catch (error) {
      console.error('Error saving CV:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleExtract = async (skipConfirmation = false) => {
    // Si du contenu existe et n'a pas été sauvegardé, demander confirmation
    const hasUnsavedChanges = markdown && markdown !== (cv.markdownContent || '');
    if (!skipConfirmation && hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Vous avez des modifications non sauvegardées. Voulez-vous vraiment régénérer et perdre ces changements ?'
      );
      if (!confirmed) return;
    }

    try {
      setExtracting(true);
      const response = await fetch('/api/cv/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: cv.id }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setMarkdown(data.data.markdownContent);
      setMissingFields(data.data.missingFields);
      onUpdate();
    } catch (error) {
      console.error('Error extracting CV:', error);
      alert('Erreur lors de l\'extraction');
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await handleSave();

      const response = await fetch('/api/cv/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: cv.id, brand }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'cv.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      onUpdate();
    } catch (error) {
      console.error('Error generating DOCX:', error);
      alert('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadFinal = async () => {
    try {
      setUploading(true);
      await handleSave();

      const response = await fetch('/api/cv/upload-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: cv.id, brand }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      alert(`CV uploadé avec succès: ${data.data.filename}`);
      onUpdate();
    } catch (error) {
      console.error('Error uploading final CV:', error);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleImprove = useCallback(
    (result: { markdownContent: string; missingFields: string[] }) => {
      setMarkdown(result.markdownContent);
      setMissingFields(result.missingFields);
      onUpdate();
    },
    [onUpdate]
  );

  const hasContent = markdown && markdown.trim().length > 0;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 space-y-4 border-b bg-card">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl truncate">
              {cv.consultantName || cv.originalName}
            </h2>
            {cv.title && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {cv.title}
              </p>
            )}
          </div>
          <BrandSelector value={brand} onChange={setBrand} />
        </div>

        {/* Workflow steps */}
        <WorkflowSteps currentStatus={cv.status} />

        {/* Missing info alert */}
        <MissingInfoAlert missingFields={missingFields} />

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasContent ? (
            <Button
              onClick={() => handleExtract(true)}
              disabled={extracting}
              variant="dreamit"
              className="flex-1 sm:flex-none"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4 mr-2" />
              )}
              Extraire avec l'IA
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Sauvegarder
              </Button>

              <Button
                onClick={() => handleExtract()}
                disabled={extracting}
                variant="outline"
                title="Régénérer l'extraction IA"
              >
                {extracting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Régénérer
              </Button>

              <Button
                onClick={() => setShowAgents(!showAgents)}
                variant="secondary"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Agents IA
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAgents ? 'rotate-180' : ''}`} />
              </Button>

              <div className="flex-1" />

              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                DOCX
              </Button>

              <Button
                variant={brand === 'DREAMIT' ? 'dreamit' : 'rupturae'}
                onClick={handleUploadFinal}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Finaliser
              </Button>
            </>
          )}
        </div>

        {/* Agent buttons (collapsible) */}
        {hasContent && showAgents && (
          <div className="pt-2 border-t animate-slide-up">
            <AgentButtons
              cvId={cv.id}
              onImprove={handleImprove}
              disabled={!hasContent}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {hasContent ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'editor' | 'source')} className="h-full flex flex-col">
            <div className="px-5 pt-4 pb-2 border-b bg-secondary/30">
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="editor" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Éditeur
                </TabsTrigger>
                <TabsTrigger value="source" className="gap-2">
                  <Code2 className="w-4 h-4" />
                  Markdown
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="editor" className="flex-1 overflow-auto m-0 scrollbar-thin">
              <MDXEditorComponent markdown={markdown} onChange={setMarkdown} />
            </TabsContent>
            <TabsContent value="source" className="flex-1 overflow-hidden m-0 p-4">
              <textarea
                className="w-full h-full p-4 font-mono text-sm bg-secondary/30 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring scrollbar-thin"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                spellCheck={false}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="relative">
              <div className="absolute inset-0 gradient-dreamit rounded-3xl blur-2xl opacity-20" />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-secondary">
                <FileSearch className="w-10 h-10 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-xl mt-6 mb-2">Prêt pour l&apos;extraction</h3>
            <p className="text-muted-foreground text-sm text-center max-w-xs">
              L'IA va analyser le CV et le convertir en format structuré Markdown
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
