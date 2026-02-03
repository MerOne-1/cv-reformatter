import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TemplateListItem, TemplateSelectItem } from '@/lib/types';

// Query keys factory
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters?: { active?: boolean }) => [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

// API functions
async function fetchTemplates(): Promise<TemplateListItem[]> {
  const response = await fetch('/api/templates');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch templates');
  return data.data;
}

async function fetchActiveTemplates(): Promise<TemplateSelectItem[]> {
  const response = await fetch('/api/templates');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch templates');
  return data.data.filter((t: TemplateListItem) => t.isActive);
}

async function createTemplate(
  template: Omit<TemplateListItem, 'id' | 'logoUrl' | 'logoHeaderUrl' | 'logoFooterUrl'>
): Promise<TemplateListItem> {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to create template');
  return data.data;
}

async function updateTemplate(
  id: string,
  updates: Partial<TemplateListItem>
): Promise<TemplateListItem> {
  const response = await fetch(`/api/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to update template');
  return data.data;
}

async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete template');
}

// Hooks
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.lists(),
    queryFn: fetchTemplates,
    staleTime: 5 * 60 * 1000, // 5 minutes - templates change rarely
  });
}

export function useActiveTemplates() {
  return useQuery({
    queryKey: templateKeys.list({ active: true }),
    queryFn: fetchActiveTemplates,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TemplateListItem> }) =>
      updateTemplate(id, updates),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(templateKeys.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: templateKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

// Helper to get a template by name from cache
export function useTemplateByName(name: string) {
  const { data: templates } = useActiveTemplates();
  return templates?.find((t) => t.name === name) ?? null;
}
