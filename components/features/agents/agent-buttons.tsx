'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AGENT_DESCRIPTIONS, AgentType } from '@/lib/prompts';
import { Sparkles, Target, BookOpen, User, Loader2 } from 'lucide-react';

interface AgentButtonsProps {
  cvId: string;
  onImprove: (result: { markdownContent: string; missingFields: string[] }) => void;
  disabled?: boolean;
}

const agentConfig: Record<AgentType, { icon: typeof Sparkles; color: string; gradient: string }> = {
  enrichisseur: {
    icon: Sparkles,
    color: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-500',
  },
  adaptateur: {
    icon: Target,
    color: 'text-sky-600',
    gradient: 'from-sky-500 to-blue-500',
  },
  contexte: {
    icon: BookOpen,
    color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-teal-500',
  },
  bio: {
    icon: User,
    color: 'text-violet-600',
    gradient: 'from-violet-500 to-purple-500',
  },
};

export function AgentButtons({ cvId, onImprove, disabled }: AgentButtonsProps) {
  const [loading, setLoading] = useState<AgentType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');

  const handleAgentClick = (agent: AgentType) => {
    if (agent === 'adaptateur') {
      setSelectedAgent(agent);
      setDialogOpen(true);
    } else {
      runAgent(agent);
    }
  };

  const runAgent = async (agent: AgentType, context?: string) => {
    try {
      setLoading(agent);
      const response = await fetch('/api/cv/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvId,
          agentType: agent,
          additionalContext: context,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to improve CV');
      }

      onImprove({
        markdownContent: data.data.markdownContent,
        missingFields: data.data.missingFields,
      });
    } catch (error) {
      console.error('Error improving CV:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de l\'amélioration');
    } finally {
      setLoading(null);
      setDialogOpen(false);
      setAdditionalContext('');
    }
  };

  const handleDialogConfirm = () => {
    if (selectedAgent) {
      runAgent(selectedAgent, additionalContext);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(AGENT_DESCRIPTIONS) as AgentType[]).map((agent) => {
          const config = agentConfig[agent];
          const Icon = config.icon;
          const info = AGENT_DESCRIPTIONS[agent];
          const isLoading = loading === agent;

          return (
            <button
              key={agent}
              onClick={() => handleAgentClick(agent)}
              disabled={disabled || loading !== null}
              className={`
                group relative overflow-hidden p-3 rounded-xl border border-border
                bg-card hover:bg-secondary/50 hover:border-border/80
                transition-all duration-200 text-left
                disabled:opacity-50 disabled:cursor-not-allowed
                focus-ring
              `}
            >
              {/* Hover gradient overlay */}
              <div className={`
                absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity
                bg-gradient-to-br ${config.gradient}
              `} />

              <div className="relative flex items-start gap-3">
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-lg
                  flex items-center justify-center
                  bg-secondary group-hover:bg-white transition-colors
                `}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{info.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {info.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-sky-600" />
              Adapter le CV
            </DialogTitle>
            <DialogDescription>
              Décrivez la mission ou le poste cible pour personnaliser le CV.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Mission de développeur full-stack React/Node.js dans le secteur bancaire..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleDialogConfirm}
              disabled={!additionalContext.trim() || loading !== null}
              className="gradient-dreamit text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Target className="w-4 h-4 mr-2" />
              )}
              Adapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
