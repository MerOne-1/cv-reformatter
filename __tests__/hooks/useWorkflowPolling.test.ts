import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkflowPolling } from '@/hooks/useWorkflowPolling';
import { ActiveWorkflow } from '@/lib/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useWorkflowPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return isRunning=false when no initialWorkflow', () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() =>
      useWorkflowPolling({
        cvId: 'cv-1',
        initialWorkflow: null,
        onComplete,
      })
    );

    expect(result.current.isRunning).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.executionId).toBeNull();
  });

  it('should return isRunning=true when initialWorkflow provided', () => {
    const onComplete = vi.fn();
    const initialWorkflow = {
      id: 'exec-1',
      status: 'RUNNING' as const,
      startedAt: new Date(),
      progress: { completed: 1, total: 3 },
    };

    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { status: 'RUNNING', progress: { completed: 1, total: 3 } },
        }),
    });

    const { result } = renderHook(() =>
      useWorkflowPolling({
        cvId: 'cv-1',
        initialWorkflow,
        onComplete,
      })
    );

    expect(result.current.isRunning).toBe(true);
    expect(result.current.progress).toEqual({ completed: 1, total: 3 });
    expect(result.current.executionId).toBe('exec-1');
  });

  it('should call POST /api/workflow/execute on startWorkflow', async () => {
    const onComplete = vi.fn();

    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { executionId: 'exec-new', status: 'PENDING' },
        }),
    });

    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { status: 'RUNNING', progress: { completed: 0, total: 2 } },
        }),
    });

    const { result } = renderHook(() =>
      useWorkflowPolling({
        cvId: 'cv-1',
        initialWorkflow: null,
        onComplete,
      })
    );

    await act(async () => {
      await result.current.startWorkflow();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/workflow/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvId: 'cv-1' }),
    });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.executionId).toBe('exec-new');
  });

  it('should reset state when cvId changes', () => {
    const onComplete = vi.fn();
    const initialWorkflow = {
      id: 'exec-1',
      status: 'RUNNING' as const,
      startedAt: new Date(),
      progress: { completed: 1, total: 3 },
    };

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: { status: 'RUNNING', progress: { completed: 1, total: 3 } },
        }),
    });

    type HookProps = { cvId: string; initialWorkflow: ActiveWorkflow | null };

    const { result, rerender } = renderHook<ReturnType<typeof useWorkflowPolling>, HookProps>(
      ({ cvId, initialWorkflow }) =>
        useWorkflowPolling({
          cvId,
          initialWorkflow,
          onComplete,
        }),
      { initialProps: { cvId: 'cv-1', initialWorkflow } as HookProps }
    );

    expect(result.current.executionId).toBe('exec-1');

    rerender({ cvId: 'cv-2', initialWorkflow: null });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.executionId).toBeNull();
  });

  it('should not start workflow if already running', async () => {
    const onComplete = vi.fn();
    const initialWorkflow = {
      id: 'exec-1',
      status: 'RUNNING' as const,
      startedAt: new Date(),
      progress: { completed: 1, total: 3 },
    };

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: { status: 'RUNNING', progress: { completed: 1, total: 3 } },
        }),
    });

    const { result } = renderHook(() =>
      useWorkflowPolling({
        cvId: 'cv-1',
        initialWorkflow,
        onComplete,
      })
    );

    const callCountBefore = mockFetch.mock.calls.length;

    await act(async () => {
      await result.current.startWorkflow();
    });

    expect(mockFetch.mock.calls.filter((c) => c[0] === '/api/workflow/execute').length).toBe(0);
  });
});
