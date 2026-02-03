import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cvKeys } from '@/lib/queries';
import { useCVStore } from '@/lib/stores';
import { CVWithImprovementsAndAudio, WorkflowMode } from '@/lib/types';

export interface WorkflowProgress {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: {
    completed: number;
    total: number;
    currentStep?: string;
  };
  error?: string;
}

interface UseWorkflowOptions {
  onComplete?: (cv: CVWithImprovementsAndAudio) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to manage workflow execution with polling
 */
export function useWorkflow(options: UseWorkflowOptions = {}) {
  const { onComplete, onError } = options;

  const queryClient = useQueryClient();
  const { selectedCV, updateSelectedCV } = useCVStore();

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);
  const currentCvIdRef = useRef<string | null>(null);

  // Check for active workflow on CV change
  useEffect(() => {
    // Annuler le polling de l'ancien CV
    cancelledRef.current = true;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }

    // Mettre à jour la référence du CV actuel
    currentCvIdRef.current = selectedCV?.id ?? null;

    if (selectedCV?.activeWorkflow) {
      setExecutionId(selectedCV.activeWorkflow.id);
      setIsRunning(true);
      setProgress({
        id: selectedCV.activeWorkflow.id,
        status: selectedCV.activeWorkflow.status as 'PENDING' | 'RUNNING',
        progress: selectedCV.activeWorkflow.progress,
      });
      // Réactiver le polling pour le nouveau CV
      cancelledRef.current = false;
    } else {
      setExecutionId(null);
      setIsRunning(false);
      setProgress(null);
    }
  }, [selectedCV?.id, selectedCV?.activeWorkflow]);

  const pollStatus = useCallback(async (execId: string, forCvId: string) => {
    if (cancelledRef.current) return;

    // Vérifier que le CV n'a pas changé pendant le polling
    if (currentCvIdRef.current !== forCvId) {
      console.log('[useWorkflow] CV changed, stopping poll for', execId);
      return;
    }

    try {
      const response = await fetch(`/api/workflow/status/${execId}`);

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch workflow status');
      }

      const status = data.data;
      setProgress(status);

      if (status.status === 'COMPLETED') {
        setIsRunning(false);
        setExecutionId(null);

        // Fetch updated CV
        if (selectedCV) {
          try {
            const cvResponse = await fetch(`/api/cv/${selectedCV.id}`);
            if (!cvResponse.ok) {
              throw new Error(`Erreur lors du chargement du CV: ${cvResponse.status}`);
            }
            const cvData = await cvResponse.json();
            if (cvData.success) {
              updateSelectedCV(cvData.data);
              queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
              onComplete?.(cvData.data);
            } else {
              console.error('[useWorkflow] CV fetch returned success: false', cvData.error);
              // Quand même invalider les queries pour rafraîchir la liste
              queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
            }
          } catch (cvError) {
            console.error('[useWorkflow] Error fetching CV after completion:', cvError);
            // Invalider les queries pour forcer un rafraîchissement
            queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
          }
        }
      } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        setIsRunning(false);
        setExecutionId(null);
        // Invalider les queries pour mettre à jour hasActiveWorkflow
        queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
        onError?.(new Error(status.error || 'Le workflow a échoué'));
      } else {
        // Continue polling
        pollingRef.current = setTimeout(() => pollStatus(execId, forCvId), 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur de connexion';
      console.error('[useWorkflow] Polling error:', errorMessage);

      setIsRunning(false);
      setExecutionId(null);
      setProgress(null);

      // Invalider les queries pour rafraîchir l'état
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });

      onError?.(error instanceof Error ? error : new Error('Erreur de polling'));
    }
  }, [selectedCV, updateSelectedCV, queryClient, onComplete, onError]);

  // Start polling when executionId changes
  useEffect(() => {
    if (executionId && isRunning && selectedCV?.id) {
      cancelledRef.current = false;
      pollStatus(executionId, selectedCV.id);
    }

    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [executionId, isRunning, selectedCV?.id, pollStatus]);

  const start = useCallback(async (mode: WorkflowMode = 'full') => {
    if (!selectedCV) return;

    try {
      setIsRunning(true);
      cancelledRef.current = false;

      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id, mode }),
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Impossible de lancer le workflow');
      }

      setExecutionId(data.data.executionId);
      setProgress({
        id: data.data.executionId,
        status: 'PENDING',
        progress: { completed: 0, total: 1 },
      });
    } catch (error) {
      setIsRunning(false);
      setProgress(null);
      onError?.(error instanceof Error ? error : new Error('Impossible de lancer le workflow'));
    }
  }, [selectedCV, onError]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
    }
    setIsRunning(false);
    setExecutionId(null);
    setProgress(null);
  }, []);

  return {
    start,
    cancel,
    isRunning,
    progress,
  };
}
