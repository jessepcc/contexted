import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from '../src/hooks/useCountdown.js';

function renderCountdownHook(targetIso: string | null, serverNowIso: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let currentTarget = targetIso;
  let currentServerNow = serverNowIso;
  let latestValue: string | null = null;

  function Harness() {
    latestValue = useCountdown(currentTarget, currentServerNow);
    return null;
  }

  act(() => {
    root.render(createElement(Harness));
  });

  return {
    read(): string | null {
      return latestValue;
    },
    rerender(next: { targetIso?: string | null; serverNowIso?: string }) {
      if (Object.prototype.hasOwnProperty.call(next, 'targetIso')) {
        currentTarget = next.targetIso ?? null;
      }
      if (next.serverNowIso) {
        currentServerNow = next.serverNowIso;
      }
      act(() => {
        root.render(createElement(Harness));
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

describe('useCountdown', () => {
  const activeRenders: Array<{ unmount: () => void }> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    while (activeRenders.length > 0) {
      activeRenders.pop()?.unmount();
    }
    vi.useRealTimers();
  });

  it('returns the current HH:MM:SS countdown for a future target', () => {
    const render = renderCountdownHook('2025-01-01T13:30:45Z', '2025-01-01T12:00:00Z');
    activeRenders.push(render);

    expect(render.read()).toBe('01:30:45');
  });

  it('accounts for server-client skew', () => {
    vi.setSystemTime(new Date('2025-01-01T11:59:55Z'));

    const render = renderCountdownHook('2025-01-01T12:01:00Z', '2025-01-01T12:00:00Z');
    activeRenders.push(render);

    expect(render.read()).toBe('00:01:00');
  });

  it('ticks down once per second until it reaches null', () => {
    const render = renderCountdownHook('2025-01-01T12:00:03Z', '2025-01-01T12:00:00Z');
    activeRenders.push(render);

    expect(render.read()).toBe('00:00:03');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(render.read()).toBe('00:00:02');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(render.read()).toBeNull();
  });

  it('returns null when the target is already in the past', () => {
    const render = renderCountdownHook('2025-01-01T11:59:00Z', '2025-01-01T12:00:00Z');
    activeRenders.push(render);

    expect(render.read()).toBeNull();
  });

  it('clears the countdown when targetIso becomes null', () => {
    const render = renderCountdownHook('2025-01-01T12:00:10Z', '2025-01-01T12:00:00Z');
    activeRenders.push(render);

    expect(render.read()).toBe('00:00:10');
    render.rerender({ targetIso: null });
    expect(render.read()).toBeNull();
  });
});
