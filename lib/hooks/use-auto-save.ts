import { useEffect, useRef, useCallback } from 'react';
import { useCVStore } from '@/lib/stores';

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
}

/**
 * Auto-saves CV content when markdown or templateName changes
 * Uses the CV store for state management
 */
export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const { delay = 1500, enabled = true } = options;

  const { selectedCV, markdown, templateName, hasUnsavedChanges, markAsSaved } = useCVStore();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  const save = useCallback(async () => {
    if (!selectedCV || isSavingRef.current) return;

    isSavingRef.current = true;

    try {
      const response = await fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdown, templateName }),
      });

      if (response.ok) {
        markAsSaved();
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [selectedCV, markdown, templateName, markAsSaved]);

  // Debounced auto-save
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges || !selectedCV) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(save, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, hasUnsavedChanges, selectedCV, save, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving: isSavingRef.current,
    hasUnsavedChanges,
    saveNow: save,
  };
}
