import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvKeys } from './cv-queries';

export interface WorkflowProgress {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: {
    completed: number;
    total: number;
    currentStep?: string;
  };
  error?: string;
  completedAt?: string;
}

// Query keys
export const workflowKeys = {
  all: ['workflows'] as const,
  status: (executionId: string) => [...workflowKeys.all, 'status', executionId] as const,
};

// API functions
async function startWorkflow(cvId: string): Promise<{ executionId: string }> {
  const response = await fetch('/api/workflow/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cvId }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to start workflow');
  return { executionId: data.data.executionId };
}

async function fetchWorkflowStatus(executionId: string): Promise<WorkflowProgress> {
  const response = await fetch(`/api/workflow/status/${executionId}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch workflow status');
  return data.data;
}

// Hooks
export function useStartWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startWorkflow,
    onSuccess: (_, cvId) => {
      // Invalidate the CV to show the active workflow
      queryClient.invalidateQueries({ queryKey: cvKeys.detail(cvId) });
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
}

export function useWorkflowStatus(executionId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: workflowKeys.status(executionId!),
    queryFn: () => fetchWorkflowStatus(executionId!),
    enabled: !!executionId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when workflow is done
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED' || data?.status === 'CANCELLED') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    staleTime: 0, // Always consider stale for polling
  });
}

// Hook to manage the full workflow lifecycle
export function useWorkflowExecution(cvId: string | null) {
  const queryClient = useQueryClient();
  const startMutation = useStartWorkflow();

  const start = async () => {
    if (!cvId) return null;
    const result = await startMutation.mutateAsync(cvId);
    return result.executionId;
  };

  const onComplete = () => {
    if (cvId) {
      // Refresh CV data after workflow completes
      queryClient.invalidateQueries({ queryKey: cvKeys.detail(cvId) });
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    }
  };

  return {
    start,
    onComplete,
    isStarting: startMutation.isPending,
    startError: startMutation.error,
  };
}
