'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveWorkflow, CVWithImprovementsAndAudio } from '@/lib/types';

interface UseWorkflowPollingOptions {
  cvId: string | undefined;
  initialWorkflow: ActiveWorkflow | null;
  onComplete: (updatedCV: CVWithImprovementsAndAudio) => void;
  onError?: (error: Error) => void;
}

interface UseWorkflowPollingReturn {
  isRunning: boolean;
  progress: { completed: number; total: number } | null;
  executionId: string | null;
  startWorkflow: () => Promise<void>;
}

export function useWorkflowPolling({
  cvId,
  initialWorkflow,
  onComplete,
  onError,
}: UseWorkflowPollingOptions): UseWorkflowPollingReturn {
  const [isRunning, setIsRunning] = useState(!!initialWorkflow);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    initialWorkflow?.progress ?? null
  );
  const [executionId, setExecutionId] = useState<string | null>(initialWorkflow?.id ?? null);

  const cancelledRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cvIdRef = useRef(cvId);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  cvIdRef.current = cvId;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const clearPollingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (execId: string) => {
    if (cancelledRef.current) return;

    try {
      const response = await fetch(`/api/workflow/status/${execId}`);
      const data = await response.json();

      if (cancelledRef.current) return;

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la récupération du statut');
      }

      const execution = data.data;

      if (execution.status === 'COMPLETED') {
        setIsRunning(false);
        setProgress(null);
        setExecutionId(null);

        const cvResponse = await fetch(`/api/cv/${cvIdRef.current}`);
        const cvData = await cvResponse.json();
        if (cvData.success) {
          onCompleteRef.current(cvData.data);
        } else if (onErrorRef.current) {
          onErrorRef.current(new Error(cvData.error || 'Échec du chargement du CV mis à jour'));
        }
        return;
      }

      if (execution.status === 'FAILED' || execution.status === 'CANCELLED') {
        setIsRunning(false);
        setProgress(null);
        setExecutionId(null);
        if (onErrorRef.current) {
          onErrorRef.current(new Error(execution.error || 'Le workflow a échoué'));
        }
        return;
      }

      setProgress(execution.progress);

      timeoutRef.current = setTimeout(() => pollStatus(execId), 2000);
    } catch (err) {
      if (cancelledRef.current) return;
      setIsRunning(false);
      setProgress(null);
      setExecutionId(null);
      if (onErrorRef.current) {
        onErrorRef.current(err instanceof Error ? err : new Error('Erreur de polling'));
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    clearPollingTimeout();

    setIsRunning(!!initialWorkflow);
    setProgress(initialWorkflow?.progress ?? null);
    setExecutionId(initialWorkflow?.id ?? null);

    if (initialWorkflow?.id) {
      pollStatus(initialWorkflow.id);
    }

    return () => {
      cancelledRef.current = true;
      clearPollingTimeout();
    };
  }, [cvId, initialWorkflow?.id, pollStatus, clearPollingTimeout]);

  const startWorkflow = useCallback(async () => {
    if (!cvIdRef.current || isRunning) return;

    try {
      setIsRunning(true);
      cancelledRef.current = false;
      clearPollingTimeout();

      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: cvIdRef.current }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du lancement du workflow');
      }

      const execId = data.data.executionId;
      setExecutionId(execId);
      setProgress({ completed: 0, total: 0 });

      pollStatus(execId);
    } catch (err) {
      setIsRunning(false);
      setProgress(null);
      setExecutionId(null);
      if (onErrorRef.current) {
        onErrorRef.current(err instanceof Error ? err : new Error('Erreur de lancement'));
      } else {
        throw err;
      }
    }
  }, [isRunning, pollStatus, clearPollingTimeout]);

  return { isRunning, progress, executionId, startWorkflow };
}
