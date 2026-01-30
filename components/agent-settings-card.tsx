'use client';

import { AIAgent } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Pencil, Power, PowerOff, Sparkles, FileText, Palette, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentSettingsCardProps {
  agent: AIAgent;
  onEdit: (agent: AIAgent) => void;
  onToggle: (agent: AIAgent) => void;
}

const agentIcons: Record<string, React.ReactNode> = {
  enrichisseur: <Sparkles className="w-5 h-5" />,
  adaptateur: <Palette className="w-5 h-5" />,
  contexte: <FileText className="w-5 h-5" />,
  bio: <UserCircle className="w-5 h-5" />,
  extraction: <FileText className="w-5 h-5" />,
};

export function AgentSettingsCard({ agent, onEdit, onToggle }: AgentSettingsCardProps) {
  const agentIcon = agentIcons[agent.name] || <Bot className="w-5 h-5" />;

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-200',
      agent.isActive
        ? 'border-dreamit/20 hover:border-dreamit/40'
        : 'opacity-70 hover:opacity-100'
    )}>
      {/* Accent bar */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-1',
          agent.isActive
            ? 'bg-gradient-to-r from-dreamit via-rupturae to-dreamit animate-gradient'
            : 'bg-border'
        )}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                agent.isActive
                  ? 'bg-gradient-to-br from-dreamit/20 to-rupturae/20 text-foreground'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {agentIcon}
            </div>
            <div>
              <CardTitle className="text-base font-sans font-semibold">{agent.displayName}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.name}</p>
            </div>
          </div>
          <Badge
            variant={agent.isActive ? 'dreamit' : 'secondary'}
            size="sm"
            dot
            dotColor={agent.isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground'}
          >
            {agent.isActive ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {agent.description}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary/50 rounded-xl p-3 border border-border">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Prompt systeme</span>
            <p className="text-sm font-medium text-foreground mt-1">
              {agent.systemPrompt.length} <span className="text-muted-foreground font-normal">chars</span>
            </p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 border border-border">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Template user</span>
            <p className="text-sm font-medium text-foreground mt-1">
              {agent.userPromptTemplate.length} <span className="text-muted-foreground font-normal">chars</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(agent)}
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifier
          </Button>
          <Button
            variant={agent.isActive ? 'outline' : 'dreamit-subtle'}
            size="sm"
            onClick={() => onToggle(agent)}
            className={cn(
              agent.isActive && 'hover:border-destructive/50 hover:text-destructive'
            )}
          >
            {agent.isActive ? (
              <PowerOff className="w-3.5 h-3.5" />
            ) : (
              <Power className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
