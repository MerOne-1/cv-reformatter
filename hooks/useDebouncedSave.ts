'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseDebouncedSaveOptions<T> {
  value: T;
  onSave: (value: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

interface UseDebouncedSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  saveNow: () => Promise<void>;
}

export function useDebouncedSave<T>({
  value,
  onSave,
  delay = 1500,
  enabled = true,
}: UseDebouncedSaveOptions<T>): UseDebouncedSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef<T>(value);
  const initialValueRef = useRef<T>(value);
  const isFirstRender = useRef(true);

  // Update refs when value changes
  valueRef.current = value;

  const performSave = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsSaving(true);
      setError(null);
      await onSave(valueRef.current);
      setLastSaved(new Date());
      initialValueRef.current = valueRef.current;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Save failed'));
    } finally {
      setIsSaving(false);
    }
  }, [onSave, enabled]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await performSave();
  }, [performSave]);

  useEffect(() => {
    // Skip first render to avoid saving initial value
    if (isFirstRender.current) {
      isFirstRender.current = false;
      initialValueRef.current = value;
      return;
    }

    if (!enabled) return;

    // Don't save if value hasn't changed from initial/last saved
    if (JSON.stringify(value) === JSON.stringify(initialValueRef.current)) {
      return;
    }

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new timer
    timerRef.current = setTimeout(() => {
      performSave();
    }, delay);

    // Cleanup on unmount or value change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay, enabled, performSave]);

  return { isSaving, lastSaved, error, saveNow };
}
