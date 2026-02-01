'use client';

import { useState, useEffect } from 'react';
import { AIAgent } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Loader2, Save, Plus } from 'lucide-react';

interface AgentEditDialogProps {
  agent: AIAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (agent: AIAgent, data: Partial<AIAgent>) => Promise<void>;
  onCreate?: (data: Omit<AIAgent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  mode?: 'edit' | 'create';
}

export function AgentEditDialog({ agent, open, onOpenChange, onSave, onCreate, mode = 'edit' }: AgentEditDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPromptTemplate, setUserPromptTemplate] = useState('');
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  const isCreateMode = mode === 'create';

  useEffect(() => {
    if (isCreateMode) {
      setName('');
      setDisplayName('');
      setDescription('');
      setSystemPrompt('Tu es un assistant expert en amélioration de CV.\n\nTon rôle est de...');
      setUserPromptTemplate('Voici le CV à améliorer :\n\n{{markdown}}\n\n{{#context}}\nContexte additionnel : {{context}}\n{{/context}}');
      setOrder(0);
      setActiveTab('info');
      setError(null);
    } else if (agent) {
      setName(agent.name);
      setDisplayName(agent.displayName);
      setDescription(agent.description);
      setSystemPrompt(agent.systemPrompt);
      setUserPromptTemplate(agent.userPromptTemplate);
      setOrder(agent.order);
      setActiveTab('info');
      setError(null);
    }
  }, [agent, isCreateMode, open]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isCreateMode && onCreate) {
        if (!name.trim()) {
          throw new Error('L\'identifiant est requis');
        }
        if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
          throw new Error('L\'identifiant doit commencer par une lettre et ne contenir que des lettres minuscules, chiffres, tirets et underscores');
        }
        if (!displayName.trim()) {
          throw new Error('Le nom d\'affichage est requis');
        }
        await onCreate({
          name: name.trim(),
          displayName: displayName.trim(),
          description: description.trim(),
          systemPrompt,
          userPromptTemplate,
          order,
          isActive: true,
          positionX: null,
          positionY: null,
        });
      } else if (agent) {
        await onSave(agent, {
          displayName,
          description,
          systemPrompt,
          userPromptTemplate,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (!isCreateMode && !agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? 'Créer un nouvel agent' : `Modifier l'agent : ${agent?.displayName}`}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? 'Configurez les informations et les prompts du nouvel agent IA.'
              : 'Modifiez les prompts et la configuration de l\'agent IA.'
            }
            {' '}Utilisez <code className="bg-secondary px-1 rounded">{'{{markdown}}'}</code> et{' '}
            <code className="bg-secondary px-1 rounded">{'{{context}}'}</code> comme placeholders.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="system">Prompt Système</TabsTrigger>
            <TabsTrigger value="user">Template Utilisateur</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto py-4">
            <TabsContent value="info" className="space-y-4 mt-0">
              {isCreateMode && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Identifiant <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    className="w-full px-3 py-2 rounded-md border bg-background font-mono"
                    placeholder="mon_agent"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identifiant unique (lettres minuscules, chiffres, tirets, underscores)
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium">
                  Nom d&apos;affichage {isCreateMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  placeholder="Mon Agent"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                  placeholder="Décrivez le rôle de cet agent..."
                />
              </div>
              {isCreateMode ? (
                <div className="space-y-2">
                  <label htmlFor="order" className="text-sm font-medium">Ordre d&apos;exécution</label>
                  <input
                    id="order"
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Les agents sont triés par ordre croissant dans l&apos;interface
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-secondary/50 rounded-lg space-y-2 text-sm">
                  <p><strong>Identifiant :</strong> <code>{agent?.name}</code></p>
                  <p><strong>Ordre :</strong> {agent?.order}</p>
                  <p><strong>Créé le :</strong> {agent && new Date(agent.createdAt).toLocaleDateString('fr-FR')}</p>
                  <p><strong>Modifié le :</strong> {agent && new Date(agent.updatedAt).toLocaleDateString('fr-FR')}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="system" className="mt-0">
              <div className="space-y-2">
                <label htmlFor="systemPrompt" className="text-sm font-medium">
                  Prompt Système ({systemPrompt.length} caractères)
                </label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={20}
                  className="font-mono text-sm resize-none"
                  placeholder="Instructions système pour l'agent IA..."
                />
              </div>
            </TabsContent>

            <TabsContent value="user" className="mt-0">
              <div className="space-y-2">
                <label htmlFor="userPromptTemplate" className="text-sm font-medium">
                  Template Utilisateur ({userPromptTemplate.length} caractères)
                </label>
                <p className="text-xs text-muted-foreground">
                  Placeholders disponibles : <code>{'{{markdown}}'}</code> (contenu CV),{' '}
                  <code>{'{{context}}'}</code> (contexte additionnel),{' '}
                  <code>{'{{#context}}...{{/context}}'}</code> (bloc conditionnel si contexte présent)
                </p>
                <Textarea
                  id="userPromptTemplate"
                  value={userPromptTemplate}
                  onChange={(e) => setUserPromptTemplate(e.target.value)}
                  rows={20}
                  className="font-mono text-sm resize-none"
                  placeholder="Template du message utilisateur..."
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isCreateMode ? 'Création...' : 'Sauvegarde...'}
              </>
            ) : (
              <>
                {isCreateMode ? <Plus className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {isCreateMode ? 'Créer l\'agent' : 'Sauvegarder'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
