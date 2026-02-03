'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentSettingsCard } from '@/components/features/agents/agent-settings-card';
import { AgentEditDialog } from '@/components/features/agents/agent-edit-dialog';
import { WorkflowEditor } from '@/components/features/agents/workflow-editor';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { TemplateCreateModal } from '@/components/features/templates/template-create-modal';
import { TemplateEditModal } from '@/components/features/templates/template-edit-modal';
import { AIAgent, TemplateListItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Palette,
  Plus,
  Settings,
  Upload,
  AlertTriangle,
  Loader2,
  Bot,
  Sparkles,
  GitBranch,
  Trash2,
  Globe,
  Pencil,
} from 'lucide-react';

export default function SettingsPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentDialogMode, setAgentDialogMode] = useState<'edit' | 'create'>('edit');
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [editModalTemplate, setEditModalTemplate] = useState<TemplateListItem | null>(null);

  // Refs for file inputs
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchTemplates();
    fetchAgents();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      if (data.success) {
        setAgents(data.data);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setAgentsLoading(false);
    }
  };

  const handleEditTemplate = (template: TemplateListItem) => {
    setEditModalTemplate(template);
  };

  const handleSaveTemplate = async (templateId: string, updates: Partial<TemplateListItem>) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        setTemplates(prev => prev.map(t => t.id === templateId ? data.data : t));
        setEditModalTemplate(null);
      }
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAgent = (agent: AIAgent) => {
    setEditingAgent(agent);
    setAgentDialogMode('edit');
    setAgentDialogOpen(true);
  };

  const handleCreateAgent = () => {
    setEditingAgent(null);
    setAgentDialogMode('create');
    setAgentDialogOpen(true);
  };

  const handleCreateAgentSave = async (data: Omit<AIAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de la création');
    }
    setAgents(prev => [...prev, result.data].sort((a, b) => a.order - b.order));
  };

  const handleToggleAgent = async (agent: AIAgent) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      const data = await response.json();
      if (data.success) {
        setAgents(prev => prev.map(a => a.id === agent.id ? data.data : a));
      }
    } catch (error) {
      console.error('Error toggling agent:', error);
    }
  };

  const handleSaveAgent = async (agent: AIAgent, updates: Partial<AIAgent>) => {
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to save agent');
    }
    setAgents(prev => prev.map(a => a.id === agent.id ? data.data : a));
  };


  const isIncomplete = (template: TemplateListItem) => {
    try {
      const config = JSON.parse(template.config);
      return config.incomplete === true;
    } catch {
      return false;
    }
  };

  const handleLogoUpload = async (templateId: string, file: File) => {
    setUploadingLogoId(templateId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/templates/${templateId}/logo`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        // Update template with new logo URL
        setTemplates(prev =>
          prev.map(t => t.id === templateId ? { ...t, logoUrl: data.data.url } : t)
        );
      } else {
        console.error('Error uploading logo:', data.error);
        alert(data.error || 'Erreur lors de l\'upload du logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Erreur lors de l\'upload du logo');
    } finally {
      setUploadingLogoId(null);
    }
  };

  const handleLogoDelete = async (templateId: string) => {
    if (!confirm('Supprimer ce logo ?')) return;

    setUploadingLogoId(templateId);
    try {
      const response = await fetch(`/api/templates/${templateId}/logo`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setTemplates(prev =>
          prev.map(t => t.id === templateId ? { ...t, logoUrl: null } : t)
        );
      } else {
        console.error('Error deleting logo:', data.error);
        alert(data.error || 'Erreur lors de la suppression du logo');
      }
    } catch (error) {
      console.error('Error deleting logo:', error);
      alert('Erreur lors de la suppression du logo');
    } finally {
      setUploadingLogoId(null);
    }
  };

  const triggerFileInput = (templateId: string) => {
    fileInputRefs.current[templateId]?.click();
  };

  const handleDeleteTemplate = async (template: TemplateListItem) => {
    if (!confirm(`Supprimer le template "${template.displayName}" ? Cette action est irréversible.`)) {
      return;
    }

    setDeletingTemplateId(template.id);
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setTemplates(prev => prev.filter(t => t.id !== template.id));
      } else {
        alert(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Erreur lors de la suppression du template');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-medium tracking-tight">Parametres</h1>
                <p className="text-xs text-muted-foreground">
                  Configuration des templates et agents IA
                </p>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        {/* Accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-dreamit/30 to-transparent" />
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="inline-flex p-1 bg-secondary/50 rounded-xl border border-border">
            <TabsTrigger
              value="templates"
              className="gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <Palette className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="agents"
              className="gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <Bot className="w-4 h-4" />
              Agents IA
            </TabsTrigger>
            <TabsTrigger
              value="workflow"
              className="gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border"
            >
              <GitBranch className="w-4 h-4" />
              Workflow
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="animate-fade-in-up">
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-dreamit/20 to-rupturae/20 border border-border flex items-center justify-center">
                    <Palette className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-medium">Templates de CV</h2>
                    <p className="text-sm text-muted-foreground">
                      Gerez les modeles visuels pour chaque marque
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => setTemplateModalOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Nouveau template
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((template) => {
                    const isDreamit = template.name.toLowerCase().includes('dreamit');
                    const incomplete = isIncomplete(template);

                    return (
                      <Card
                        key={template.id}
                        className={cn(
                          'relative overflow-hidden transition-all duration-200 group',
                          incomplete
                            ? 'border-warning/30 hover:border-warning/50'
                            : isDreamit
                              ? 'border-dreamit/20 hover:border-dreamit/40'
                              : 'border-rupturae/20 hover:border-rupturae/40'
                        )}
                      >
                        {/* Accent bar */}
                        <div
                          className={cn(
                            'absolute top-0 left-0 right-0 h-1 transition-opacity',
                            incomplete
                              ? 'bg-gradient-to-r from-warning to-warning/60'
                              : isDreamit
                                ? 'bg-gradient-to-r from-dreamit via-dreamit-glow to-dreamit'
                                : 'bg-gradient-to-r from-rupturae via-rupturae-glow to-rupturae'
                          )}
                        />

                        {/* Hidden file input */}
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[template.id] = el; }}
                          className="hidden"
                          accept="image/png,image/jpeg,image/jpg,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleLogoUpload(template.id, file);
                            }
                            e.target.value = '';
                          }}
                        />

                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {/* Logo ou initiales en fallback */}
                              {template.logoUrl ? (
                                <img
                                  src={template.logoUrl}
                                  alt={template.displayName}
                                  className="h-10 max-w-[80px] object-contain flex-shrink-0"
                                />
                              ) : (
                                <div
                                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0"
                                  style={{
                                    background: `linear-gradient(135deg, ${template.primaryColor}, ${template.secondaryColor})`,
                                    boxShadow: `0 4px 12px -4px ${template.primaryColor}50`,
                                  }}
                                >
                                  {template.displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-base font-sans font-semibold truncate">
                                    {template.displayName}
                                  </CardTitle>
                                  {incomplete && (
                                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                                  {template.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleEditTemplate(template)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteTemplate(template)}
                                disabled={deletingTemplateId === template.id}
                              >
                                {deletingTemplateId === template.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Infos compactes */}
                          <div className="flex items-center gap-4 flex-wrap">
                            {/* Couleurs */}
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-1">
                                <div
                                  className="w-5 h-5 rounded-full border-2 border-card"
                                  style={{ backgroundColor: template.primaryColor }}
                                  title={`Primaire: ${template.primaryColor}`}
                                />
                                <div
                                  className="w-5 h-5 rounded-full border-2 border-card"
                                  style={{ backgroundColor: template.secondaryColor }}
                                  title={`Secondaire: ${template.secondaryColor}`}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">Couleurs</span>
                            </div>

                            {/* Site web */}
                            {template.website && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Globe className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[120px]">{template.website}</span>
                              </div>
                            )}
                          </div>

                          {/* Upload logo */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerFileInput(template.id)}
                            disabled={uploadingLogoId === template.id}
                            className="w-full"
                          >
                            {uploadingLogoId === template.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                {template.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
                              </>
                            )}
                          </Button>

                          {/* Warning si incomplet */}
                          {incomplete && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
                              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                              <p className="text-[11px] text-warning/90 leading-tight">
                                Configuration requise avant utilisation
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="animate-fade-in-up">
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rupturae/20 to-dreamit/20 border border-border flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-medium">Agents IA</h2>
                    <p className="text-sm text-muted-foreground">
                      Configurez les prompts des agents d'amelioration de CV
                    </p>
                  </div>
                </div>
                <Button onClick={handleCreateAgent} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nouvel agent
                </Button>
              </div>

              {agentsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  </div>
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-3xl bg-secondary/50 border border-border flex items-center justify-center mx-auto mb-6">
                    <Bot className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-display text-lg font-medium mb-2">Aucun agent configure</h3>
                  <p className="text-sm text-muted-foreground">
                    Executez le script de seed pour initialiser les agents
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {agents.map((agent) => (
                    <AgentSettingsCard
                      key={agent.id}
                      agent={agent}
                      onEdit={handleEditAgent}
                      onToggle={handleToggleAgent}
                    />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* Workflow Tab */}
          <TabsContent value="workflow" className="animate-fade-in-up">
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-border flex items-center justify-center">
                    <GitBranch className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-medium">Workflow des Agents</h2>
                    <p className="text-sm text-muted-foreground">
                      Definissez la hierarchie et les connexions entre agents
                    </p>
                  </div>
                </div>
              </div>

              <WorkflowEditor onSave={fetchAgents} />
            </section>
          </TabsContent>
        </Tabs>

        <AgentEditDialog
          agent={editingAgent}
          open={agentDialogOpen}
          onOpenChange={setAgentDialogOpen}
          onSave={handleSaveAgent}
          onCreate={handleCreateAgentSave}
          mode={agentDialogMode}
        />

        <TemplateCreateModal
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onCreated={fetchTemplates}
        />

        <TemplateEditModal
          template={editModalTemplate}
          onClose={() => setEditModalTemplate(null)}
          onSave={handleSaveTemplate}
          saving={saving}
        />
      </main>
    </div>
  );
}
