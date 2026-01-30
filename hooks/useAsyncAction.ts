'use client';

import { useState, useCallback, useRef } from 'react';

interface UseAsyncActionOptions<TResult> {
  onSuccess?: (result: TResult) => void;
  onError?: (error: Error) => void;
}

interface UseAsyncActionReturn<TArgs extends unknown[], TResult> {
  execute: (...args: TArgs) => Promise<TResult | undefined>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions<TResult> = {}
): UseAsyncActionReturn<TArgs, TResult> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await asyncFn(...args);
        optionsRef.current.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        optionsRef.current.onError?.(error);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { execute, isLoading, error, reset };
}

// Helper for multiple concurrent actions
interface UseMultipleAsyncActionsReturn<TKeys extends string> {
  execute: <TResult>(key: TKeys, fn: () => Promise<TResult>) => Promise<TResult | undefined>;
  isLoading: (key: TKeys) => boolean;
  isAnyLoading: boolean;
  error: (key: TKeys) => Error | null;
  reset: (key?: TKeys) => void;
}

export function useMultipleAsyncActions<TKeys extends string>(): UseMultipleAsyncActionsReturn<TKeys> {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, Error | null>>({});

  const execute = useCallback(
    async <TResult>(key: TKeys, fn: () => Promise<TResult>): Promise<TResult | undefined> => {
      try {
        setLoadingMap((prev) => ({ ...prev, [key]: true }));
        setErrorMap((prev) => ({ ...prev, [key]: null }));
        const result = await fn();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setErrorMap((prev) => ({ ...prev, [key]: error }));
        return undefined;
      } finally {
        setLoadingMap((prev) => ({ ...prev, [key]: false }));
      }
    },
    []
  );

  const isLoading = useCallback((key: TKeys) => loadingMap[key] ?? false, [loadingMap]);
  const isAnyLoading = Object.values(loadingMap).some(Boolean);
  const error = useCallback((key: TKeys) => errorMap[key] ?? null, [errorMap]);

  const reset = useCallback((key?: TKeys) => {
    if (key) {
      setErrorMap((prev) => ({ ...prev, [key]: null }));
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    } else {
      setErrorMap({});
      setLoadingMap({});
    }
  }, []);

  return { execute, isLoading, isAnyLoading, error, reset };
}
