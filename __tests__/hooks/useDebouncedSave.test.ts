import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not save on initial render', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useDebouncedSave({
        value: 'initial',
        onSave,
        delay: 1000,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('should debounce save calls', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ value }) =>
        useDebouncedSave({
          value,
          onSave,
          delay: 1000,
        }),
      { initialProps: { value: 'initial' } }
    );

    // Change value
    rerender({ value: 'changed' });

    // Before delay
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).not.toHaveBeenCalled();

    // After delay
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('changed');
  });

  it('should reset timer on value change', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ value }) =>
        useDebouncedSave({
          value,
          onSave,
          delay: 1000,
        }),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'first' });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    rerender({ value: 'second' });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('second');
  });

  it('should not save when disabled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ value, enabled }) =>
        useDebouncedSave({
          value,
          onSave,
          delay: 100,
          enabled,
        }),
      { initialProps: { value: 'initial', enabled: false } }
    );

    rerender({ value: 'changed', enabled: false });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('should allow immediate save with saveNow', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ value }) =>
        useDebouncedSave({
          value,
          onSave,
          delay: 10000,
        }),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'changed' });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledWith('changed');
  });
});
