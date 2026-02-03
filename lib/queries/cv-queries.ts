import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CVListItem, CVWithImprovementsAndAudio } from '@/lib/types';

// Query keys factory
export const cvKeys = {
  all: ['cvs'] as const,
  lists: () => [...cvKeys.all, 'list'] as const,
  list: (filters?: { status?: string }) => [...cvKeys.lists(), filters] as const,
  details: () => [...cvKeys.all, 'detail'] as const,
  detail: (id: string) => [...cvKeys.details(), id] as const,
};

// API functions
async function fetchCVList(): Promise<CVListItem[]> {
  const response = await fetch('/api/cv/list');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch CV list');
  return data.data;
}

async function fetchCVDetail(id: string): Promise<CVWithImprovementsAndAudio> {
  const response = await fetch(`/api/cv/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch CV');
  return data.data;
}

async function updateCV(
  id: string,
  updates: {
    markdownContent?: string;
    templateName?: string;
    notes?: string;
    futureMissionNotes?: string;
  }
): Promise<CVWithImprovementsAndAudio> {
  const response = await fetch(`/api/cv/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to update CV');
  return data.data;
}

async function deleteCV(id: string): Promise<void> {
  const response = await fetch(`/api/cv/${id}`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete CV');
}

async function extractCV(id: string): Promise<CVWithImprovementsAndAudio> {
  const response = await fetch('/api/cv/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cvId: id }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to extract CV');
  return data.data;
}

// Hooks
export function useCVList() {
  return useQuery({
    queryKey: cvKeys.lists(),
    queryFn: fetchCVList,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCVDetail(id: string | null) {
  return useQuery({
    queryKey: cvKeys.detail(id!),
    queryFn: () => fetchCVDetail(id!),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useUpdateCV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateCV>[1] }) =>
      updateCV(id, updates),
    onSuccess: (data, variables) => {
      // Update the detail cache
      queryClient.setQueryData(cvKeys.detail(variables.id), data);
      // Invalidate the list to refresh status/name if changed
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
}

export function useDeleteCV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCV,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: cvKeys.detail(deletedId) });
      // Refresh the list
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
}

export function useExtractCV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: extractCV,
    onSuccess: (data) => {
      // Update the detail cache
      queryClient.setQueryData(cvKeys.detail(data.id), data);
      // Refresh the list to update status
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
}

// Utility to prefetch a CV detail
export function usePrefetchCV() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: cvKeys.detail(id),
      queryFn: () => fetchCVDetail(id),
      staleTime: 60 * 1000,
    });
  };
}
