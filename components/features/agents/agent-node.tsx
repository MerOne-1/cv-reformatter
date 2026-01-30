'use client';

import { Bot, ArrowRight, ArrowLeft, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AgentNodeProps {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
  level: number;
  inputCount: number;
  outputCount: number;
  isSelected?: boolean;
  isConnecting?: boolean;
  connectionMode?: 'source' | 'target' | null;
  onClick?: () => void;
  onStartConnection?: (type: 'source' | 'target') => void;
}

export function AgentNode({
  name,
  displayName,
  isActive,
  inputCount,
  outputCount,
  isSelected,
  isConnecting,
  connectionMode,
  onClick,
  onStartConnection,
}: AgentNodeProps) {
  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border-2 bg-card shadow-sm transition-all cursor-pointer min-w-[180px]',
        isActive ? 'border-primary/50' : 'border-muted opacity-60',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        isConnecting && connectionMode === 'target' && 'border-green-500 border-dashed',
        isConnecting && connectionMode === 'source' && 'border-blue-500 border-dashed'
      )}
      onClick={onClick}
    >
      <div className="absolute -top-2 -right-2">
        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
          {isActive ? 'Actif' : 'Inactif'}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{displayName}</h3>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors',
            inputCount > 0 && 'text-blue-500'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onStartConnection?.('target');
          }}
          title="Entrées"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>{inputCount}</span>
        </button>

        <Power
          className={cn(
            'h-4 w-4',
            isActive ? 'text-green-500' : 'text-muted-foreground'
          )}
        />

        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors',
            outputCount > 0 && 'text-green-500'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onStartConnection?.('source');
          }}
          title="Sorties"
        >
          <span>{outputCount}</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
