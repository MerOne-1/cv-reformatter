import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cvKeys } from '@/lib/queries';
import { useCVStore } from '@/lib/stores';
import { CVWithImprovementsAndAudio } from '@/lib/types';

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

  // Check for active workflow on CV change
  useEffect(() => {
    if (selectedCV?.activeWorkflow) {
      setExecutionId(selectedCV.activeWorkflow.id);
      setIsRunning(true);
      setProgress({
        id: selectedCV.activeWorkflow.id,
        status: selectedCV.activeWorkflow.status as 'PENDING' | 'RUNNING',
        progress: selectedCV.activeWorkflow.progress,
      });
    } else {
      setExecutionId(null);
      setIsRunning(false);
      setProgress(null);
    }
  }, [selectedCV?.id, selectedCV?.activeWorkflow]);

  const pollStatus = useCallback(async (execId: string) => {
    if (cancelledRef.current) return;

    try {
      const response = await fetch(`/api/workflow/status/${execId}`);
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
          const cvResponse = await fetch(`/api/cv/${selectedCV.id}`);
          const cvData = await cvResponse.json();
          if (cvData.success) {
            updateSelectedCV(cvData.data);
            queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
            onComplete?.(cvData.data);
          }
        }
      } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        setIsRunning(false);
        setExecutionId(null);
        onError?.(new Error(status.error || 'Workflow failed'));
      } else {
        // Continue polling
        pollingRef.current = setTimeout(() => pollStatus(execId), 2000);
      }
    } catch (error) {
      console.error('Polling error:', error);
      onError?.(error instanceof Error ? error : new Error('Polling failed'));
      setIsRunning(false);
      setExecutionId(null);
    }
  }, [selectedCV, updateSelectedCV, queryClient, onComplete, onError]);

  // Start polling when executionId changes
  useEffect(() => {
    if (executionId && isRunning) {
      cancelledRef.current = false;
      pollStatus(executionId);
    }

    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [executionId, isRunning, pollStatus]);

  const start = useCallback(async () => {
    if (!selectedCV) return;

    try {
      setIsRunning(true);
      cancelledRef.current = false;

      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to start workflow');
      }

      setExecutionId(data.data.executionId);
      setProgress({
        id: data.data.executionId,
        status: 'PENDING',
        progress: { completed: 0, total: 1 },
      });
    } catch (error) {
      setIsRunning(false);
      onError?.(error instanceof Error ? error : new Error('Failed to start workflow'));
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
