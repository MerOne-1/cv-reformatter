'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  StopCircle,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { StepStatus, ExecutionStatus } from '@/lib/types';

interface WorkflowStep {
  id: string;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  agent: {
    id: string;
    name: string;
    displayName: string;
  };
}

interface WorkflowExecution {
  id: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  cv: {
    id: string;
    originalName: string;
    consultantName: string | null;
  };
  steps: WorkflowStep[];
  summary: {
    total: number;
    pending: number;
    waitingInputs: number;
    running: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

interface WorkflowMonitorProps {
  executionId: string;
  onClose?: () => void;
  autoRefresh?: boolean;
}

const statusConfig: Record<
  StepStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  PENDING: { icon: Clock, color: 'text-muted-foreground', label: 'En attente' },
  WAITING_INPUTS: { icon: Clock, color: 'text-yellow-500', label: 'Attente entrées' },
  RUNNING: { icon: Loader2, color: 'text-blue-500', label: 'En cours' },
  COMPLETED: { icon: CheckCircle2, color: 'text-green-500', label: 'Terminé' },
  FAILED: { icon: XCircle, color: 'text-red-500', label: 'Échoué' },
  SKIPPED: { icon: AlertCircle, color: 'text-muted-foreground', label: 'Ignoré' },
};

const executionStatusConfig: Record<
  ExecutionStatus,
  { color: string; label: string }
> = {
  PENDING: { color: 'bg-muted', label: 'En attente' },
  RUNNING: { color: 'bg-blue-500', label: 'En cours' },
  COMPLETED: { color: 'bg-green-500', label: 'Terminé' },
  FAILED: { color: 'bg-red-500', label: 'Échoué' },
  CANCELLED: { color: 'bg-yellow-500', label: 'Annulé' },
};

export function WorkflowMonitor({
  executionId,
  onClose,
  autoRefresh = true,
}: WorkflowMonitorProps) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchExecution = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflow/${executionId}`);
      const data = await response.json();
      if (data.success) {
        setExecution(data.data);
        setError(null);
      } else {
        setError(data.error || 'Erreur lors du chargement');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    fetchExecution();
  }, [fetchExecution]);

  useEffect(() => {
    if (!autoRefresh || !execution) return;

    const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(execution.status);
    if (isTerminal) return;

    const interval = setInterval(fetchExecution, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, execution, fetchExecution]);

  const handleCancel = async () => {
    try {
      setCancelling(true);
      const response = await fetch(`/api/workflow/${executionId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        await fetchExecution();
      } else {
        setError(data.error || 'Erreur lors de l\'annulation');
      }
    } catch {
      setError('Erreur lors de l\'annulation');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!execution) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Exécution introuvable'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isRunning = execution.status === 'RUNNING' || execution.status === 'PENDING';
  const statusConf = executionStatusConfig[execution.status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Workflow
            <Badge className={statusConf.color}>{statusConf.label}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {execution.cv.consultantName || execution.cv.originalName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchExecution}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isRunning && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={cancelling}>
                  {cancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  Annuler
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annuler le workflow ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va arrêter tous les agents en cours d&apos;exécution.
                    Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Retour</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>
                    Confirmer l&apos;annulation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {execution.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{execution.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-6 gap-2 mb-6 text-center text-sm">
          <div className="p-2 bg-muted rounded">
            <div className="font-semibold">{execution.summary.total}</div>
            <div className="text-muted-foreground">Total</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-semibold text-muted-foreground">
              {execution.summary.pending}
            </div>
            <div className="text-muted-foreground">En attente</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-semibold text-blue-500">
              {execution.summary.running}
            </div>
            <div className="text-muted-foreground">En cours</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-semibold text-green-500">
              {execution.summary.completed}
            </div>
            <div className="text-muted-foreground">Terminés</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-semibold text-red-500">
              {execution.summary.failed}
            </div>
            <div className="text-muted-foreground">Échoués</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-semibold text-muted-foreground">
              {execution.summary.skipped}
            </div>
            <div className="text-muted-foreground">Ignorés</div>
          </div>
        </div>

        <div className="space-y-3">
          {execution.steps.map((step) => {
            const config = statusConfig[step.status];
            const Icon = config.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border',
                  step.status === 'RUNNING' && 'bg-blue-50 border-blue-200',
                  step.status === 'FAILED' && 'bg-red-50 border-red-200',
                  step.status === 'COMPLETED' && 'bg-green-50 border-green-200'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    config.color,
                    step.status === 'RUNNING' && 'animate-spin'
                  )}
                />

                <div className="flex items-center gap-2 flex-1">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{step.agent.displayName}</span>
                  <span className="text-sm text-muted-foreground">
                    ({step.agent.name})
                  </span>
                </div>

                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>

                {step.error && (
                  <span className="text-xs text-red-500 max-w-xs truncate">
                    {step.error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
