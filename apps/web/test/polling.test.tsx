import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from '../src/polling.js';

function mountPollingHarness(onTick: () => Promise<void> | void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    usePolling({
      enabled: true,
      intervalMs: 100,
      backgroundIntervalMs: 200,
      onTick
    });
    return null;
  }

  act(() => {
    root.render(createElement(Harness));
  });

  return {
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops scheduling ticks after unmount', async () => {
    const onTick = vi.fn(async () => undefined);
    const render = mountPollingHarness(onTick);

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    render.unmount();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
