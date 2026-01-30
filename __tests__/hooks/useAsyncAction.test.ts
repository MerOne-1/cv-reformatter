import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAsyncAction, useMultipleAsyncActions } from '@/hooks/useAsyncAction';

describe('useAsyncAction', () => {
  it('should start with initial state', () => {
    const asyncFn = vi.fn().mockResolvedValue('result');

    const { result } = renderHook(() => useAsyncAction(asyncFn));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should set isLoading during execution', async () => {
    let resolvePromise: (value: string) => void;
    const asyncFn = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      })
    );

    const { result } = renderHook(() => useAsyncAction(asyncFn));

    act(() => {
      result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!('done');
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should return result on success', async () => {
    const asyncFn = vi.fn().mockResolvedValue('success result');

    const { result } = renderHook(() => useAsyncAction(asyncFn));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.execute();
    });

    expect(returnValue).toBe('success result');
    expect(result.current.error).toBe(null);
  });

  it('should call onSuccess callback', async () => {
    const asyncFn = vi.fn().mockResolvedValue('result');
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAsyncAction(asyncFn, { onSuccess })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledWith('result');
  });

  it('should set error on failure', async () => {
    const error = new Error('Test error');
    const asyncFn = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useAsyncAction(asyncFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.isLoading).toBe(false);
  });

  it('should call onError callback', async () => {
    const error = new Error('Test error');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useAsyncAction(asyncFn, { onError })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should pass arguments to async function', async () => {
    const asyncFn = vi.fn().mockResolvedValue('result');

    const { result } = renderHook(() =>
      useAsyncAction(asyncFn)
    );

    await act(async () => {
      await result.current.execute('arg1', 'arg2');
    });

    expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should reset error state', async () => {
    const error = new Error('Test error');
    const asyncFn = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useAsyncAction(asyncFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toEqual(error);

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBe(null);
  });

  it('should convert non-Error to Error', async () => {
    const asyncFn = vi.fn().mockRejectedValue('string error');

    const { result } = renderHook(() => useAsyncAction(asyncFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });
});

describe('useMultipleAsyncActions', () => {
  it('should track loading state per key', async () => {
    const { result } = renderHook(() => useMultipleAsyncActions<'action1' | 'action2'>());

    let resolveAction1: () => void;
    const action1Promise = new Promise<void>((resolve) => {
      resolveAction1 = resolve;
    });

    act(() => {
      result.current.execute('action1', () => action1Promise);
    });

    expect(result.current.isLoading('action1')).toBe(true);
    expect(result.current.isLoading('action2')).toBe(false);
    expect(result.current.isAnyLoading).toBe(true);

    await act(async () => {
      resolveAction1!();
    });

    await waitFor(() => {
      expect(result.current.isLoading('action1')).toBe(false);
    });
  });

  it('should track errors per key', async () => {
    const error = new Error('Action 1 failed');
    const { result } = renderHook(() => useMultipleAsyncActions<'action1' | 'action2'>());

    await act(async () => {
      await result.current.execute('action1', () => Promise.reject(error));
    });

    expect(result.current.error('action1')).toEqual(error);
    expect(result.current.error('action2')).toBe(null);
  });

  it('should reset specific key', async () => {
    const error = new Error('Failed');
    const { result } = renderHook(() => useMultipleAsyncActions<'action1' | 'action2'>());

    await act(async () => {
      await result.current.execute('action1', () => Promise.reject(error));
    });

    expect(result.current.error('action1')).toEqual(error);

    act(() => {
      result.current.reset('action1');
    });

    expect(result.current.error('action1')).toBe(null);
  });

  it('should reset all keys', async () => {
    const error = new Error('Failed');
    const { result } = renderHook(() => useMultipleAsyncActions<'action1' | 'action2'>());

    await act(async () => {
      await result.current.execute('action1', () => Promise.reject(error));
      await result.current.execute('action2', () => Promise.reject(error));
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.error('action1')).toBe(null);
    expect(result.current.error('action2')).toBe(null);
  });
});
