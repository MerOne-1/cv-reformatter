'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowButtonProps {
  cvId: string;
  onComplete: (result: { markdownContent: string; missingFields: string[] }) => void;
  disabled?: boolean;
}

type WorkflowStatus = 'idle' | 'running' | 'polling' | 'completed' | 'failed';

export function WorkflowButton({ cvId, onComplete, disabled }: WorkflowButtonProps) {
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollWorkflowStatus = async (execId: string) => {
    const maxAttempts = 60; // 2 minutes max (60 * 2s)
    let attempts = 0;

    const poll = async (): Promise<void> => {
      attempts++;

      try {
        const response = await fetch(`/api/workflow/status/${execId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Erreur lors de la vérification du statut');
        }

        const execution = data.data;

        if (execution.status === 'COMPLETED') {
          // Récupérer le CV mis à jour
          const cvResponse = await fetch(`/api/cv/${cvId}`);
          const cvData = await cvResponse.json();

          if (cvData.success) {
            setStatus('completed');
            onComplete({
              markdownContent: cvData.data.markdownContent,
              missingFields: cvData.data.missingFields || [],
            });
          }
          return;
        }

        if (execution.status === 'FAILED') {
          throw new Error(execution.error || 'Le workflow a échoué');
        }

        // Continuer à polling si toujours en cours
        if (attempts < maxAttempts && (execution.status === 'PENDING' || execution.status === 'RUNNING')) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return poll();
        }

        if (attempts >= maxAttempts) {
          throw new Error('Timeout: le workflow prend trop de temps');
        }
      } catch (err) {
        setStatus('failed');
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    };

    await poll();
  };

  const launchWorkflow = async () => {
    try {
      setStatus('running');
      setError(null);

      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Échec du lancement du workflow');
      }

      setExecutionId(data.data.executionId);
      setStatus('polling');

      // Commencer le polling
      await pollWorkflowStatus(data.data.executionId);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'running':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Lancement...
          </>
        );
      case 'polling':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Traitement en cours...
          </>
        );
      case 'completed':
        return (
          <>
            <CheckCircle className="w-4 h-4" />
            Terminé !
          </>
        );
      case 'failed':
        return (
          <>
            <XCircle className="w-4 h-4" />
            Réessayer
          </>
        );
      default:
        return (
          <>
            <Play className="w-4 h-4" />
            Lancer le workflow
          </>
        );
    }
  };

  const isDisabled = disabled || status === 'running' || status === 'polling';

  return (
    <div className="space-y-2">
      <Button
        onClick={launchWorkflow}
        disabled={isDisabled}
        className={`
          w-full gap-2 transition-all
          ${status === 'completed' ? 'bg-green-600 hover:bg-green-700' : ''}
          ${status === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
        `}
        size="lg"
      >
        {getButtonContent()}
      </Button>

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}

      {status === 'polling' && (
        <p className="text-xs text-muted-foreground text-center">
          Les agents traitent votre CV selon le workflow configuré...
        </p>
      )}
    </div>
  );
}

// Export pour rétrocompatibilité (à supprimer après migration)
export type AgentType = 'enrichisseur' | 'adaptateur' | 'contexte' | 'bio';

export function AgentButtons({ cvId, onImprove, disabled }: {
  cvId: string;
  onImprove: (result: { markdownContent: string; missingFields: string[] }) => void;
  disabled?: boolean;
}) {
  return <WorkflowButton cvId={cvId} onComplete={onImprove} disabled={disabled} />;
}
