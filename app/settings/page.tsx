'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, AccentCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentSettingsCard } from '@/components/agent-settings-card';
import { AgentEditDialog } from '@/components/agent-edit-dialog';
import { AgentGraphEditor } from '@/components/agent-graph-editor';
import { ThemeToggle } from '@/components/theme-toggle';
import { AIAgent } from '@/lib/types';
import {
  ArrowLeft,
  Palette,
  Plus,
  Settings,
  Upload,
  Check,
  AlertTriangle,
  Loader2,
  Bot,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  config: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentDialogMode, setAgentDialogMode] = useState<'edit' | 'create'>('edit');

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    primaryColor: '',
    secondaryColor: '',
  });

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

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setFormData({
      displayName: template.displayName,
      primaryColor: template.primaryColor,
      secondaryColor: template.secondaryColor,
    });
  };

  const handleSave = async (id: string) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setTemplates(prev => prev.map(t => t.id === id ? data.data : t));
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const isIncomplete = (template: Template) => {
    try {
      const config = JSON.parse(template.config);
      return config.incomplete === true;
    } catch {
      return false;
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
                <Button variant="outline" disabled className="gap-2">
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
                <div className="grid gap-5">
                  {templates.map((template) => {
                    const isDreamit = template.name.toLowerCase().includes('dreamit');
                    return (
                      <AccentCard
                        key={template.id}
                        accentColor={isDreamit ? 'dreamit' : 'rupturae'}
                        accentPosition="top"
                        className="overflow-hidden"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                                style={{
                                  background: `linear-gradient(135deg, ${template.primaryColor}, ${template.secondaryColor})`,
                                  boxShadow: `0 8px 24px -8px ${template.primaryColor}40`,
                                }}
                              >
                                {template.displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <CardTitle className="text-lg flex items-center gap-3">
                                  {editingId === template.id ? (
                                    <input
                                      type="text"
                                      value={formData.displayName}
                                      onChange={(e) =>
                                        setFormData({ ...formData, displayName: e.target.value })
                                      }
                                      className="px-3 py-1.5 bg-input border border-border rounded-lg text-lg font-display focus:outline-none focus:ring-2 focus:ring-ring/50"
                                    />
                                  ) : (
                                    template.displayName
                                  )}
                                  {isIncomplete(template) && (
                                    <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      A configurer
                                    </Badge>
                                  )}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground font-mono mt-1">
                                  {template.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {editingId === template.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Annuler
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={isDreamit ? 'dreamit' : 'rupturae'}
                                    onClick={() => handleSave(template.id)}
                                    disabled={saving}
                                  >
                                    {saving ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    Sauvegarder
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(template)}
                                >
                                  <Settings className="w-4 h-4 mr-2" />
                                  Modifier
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-8">
                            {/* Colors */}
                            <div>
                              <p className="text-sm font-medium mb-4 text-muted-foreground">Couleurs</p>
                              <div className="flex gap-4">
                                <div className="flex items-center gap-3">
                                  {editingId === template.id ? (
                                    <input
                                      type="color"
                                      value={formData.primaryColor}
                                      onChange={(e) =>
                                        setFormData({ ...formData, primaryColor: e.target.value })
                                      }
                                      className="w-10 h-10 rounded-xl cursor-pointer border-2 border-border"
                                    />
                                  ) : (
                                    <div
                                      className="w-10 h-10 rounded-xl border-2 border-border shadow-inner"
                                      style={{ backgroundColor: template.primaryColor }}
                                    />
                                  )}
                                  <div>
                                    <p className="text-xs text-muted-foreground">Primaire</p>
                                    <p className="text-xs font-mono text-foreground">
                                      {editingId === template.id ? formData.primaryColor : template.primaryColor}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {editingId === template.id ? (
                                    <input
                                      type="color"
                                      value={formData.secondaryColor}
                                      onChange={(e) =>
                                        setFormData({ ...formData, secondaryColor: e.target.value })
                                      }
                                      className="w-10 h-10 rounded-xl cursor-pointer border-2 border-border"
                                    />
                                  ) : (
                                    <div
                                      className="w-10 h-10 rounded-xl border-2 border-border shadow-inner"
                                      style={{ backgroundColor: template.secondaryColor }}
                                    />
                                  )}
                                  <div>
                                    <p className="text-xs text-muted-foreground">Secondaire</p>
                                    <p className="text-xs font-mono text-foreground">
                                      {editingId === template.id ? formData.secondaryColor : template.secondaryColor}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Logo */}
                            <div>
                              <p className="text-sm font-medium mb-4 text-muted-foreground">Logo</p>
                              {template.logoUrl ? (
                                <div className="flex items-center gap-4">
                                  <div className="h-12 px-4 bg-card rounded-xl border border-border flex items-center">
                                    <img
                                      src={template.logoUrl}
                                      alt={template.displayName}
                                      className="h-8 object-contain"
                                    />
                                  </div>
                                  <Button variant="outline" size="sm">
                                    Changer
                                  </Button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" disabled={editingId !== template.id}>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Ajouter un logo
                                </Button>
                              )}
                            </div>
                          </div>

                          {isIncomplete(template) && (
                            <div className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/20">
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-warning">Configuration incomplete</p>
                                  <p className="text-xs text-warning/80 mt-1">
                                    Ce template necessite une configuration complete pour etre utilise.
                                    Uploadez le template PDF/DOCX de reference pour configurer la mise en page.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </AccentCard>
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

              <AgentGraphEditor onSave={fetchAgents} />

              <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
                <h3 className="font-medium mb-2">Comment utiliser</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Cliquez sur les fleches d&apos;un agent pour creer une connexion</li>
                  <li>• Les agents sans entrees sont executes en premier (agents racines)</li>
                  <li>• Un agent attend toutes ses entrees avant de s&apos;executer</li>
                  <li>• Cliquez sur une connexion pour la supprimer</li>
                </ul>
              </div>
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
      </main>
    </div>
  );
}
