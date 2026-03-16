import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  staggerChildren,
  staggerItem,
  useCountUp,
  useReducedMotion,
  useSpring
} from '../src/hooks/useDelight.js';

function renderHookValue<T>(useHook: () => T) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestValue!: T;

  function Harness() {
    latestValue = useHook();
    return null;
  }

  act(() => {
    root.render(createElement(Harness));
  });

  return {
    read(): T {
      return latestValue;
    },
    rerender() {
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

describe('useDelight helpers', () => {
  const renders: Array<{ unmount: () => void }> = [];
  let mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
  let mediaMatches = false;

  beforeEach(() => {
    vi.useFakeTimers();
    mediaListeners = new Set();
    mediaMatches = false;

    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: mediaMatches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (_name: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners.delete(listener);
      }
    })));

    let rafTimestamp = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) =>
        window.setTimeout(() => {
          rafTimestamp += 16;
          callback(rafTimestamp);
        }, 16)
      )
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((handle: number) => {
        window.clearTimeout(handle);
      })
    );
  });

  afterEach(() => {
    while (renders.length > 0) {
      renders.pop()?.unmount();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reacts to reduced-motion preference changes', () => {
    const render = renderHookValue(() => useReducedMotion());
    renders.push(render);

    expect(render.read()).toBe(false);

    mediaMatches = true;
    act(() => {
      mediaListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    expect(render.read()).toBe(true);
  });

  it('returns stable stagger helpers', () => {
    expect(staggerChildren()).toEqual({
      animate: { transition: { staggerChildren: 0.1 } }
    });
    expect(staggerItem(3, 0.2)).toEqual({
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay: 0.6000000000000001
      }
    });
  });

  it('returns reduced and full spring variants appropriately', () => {
    const reducedRender = renderHookValue(() => useSpring(true));
    renders.push(reducedRender);
    expect(reducedRender.read().enter.transition).toEqual({ duration: 0 });
    expect(reducedRender.read().hover).toEqual({});

    const fullRender = renderHookValue(() => useSpring(false));
    renders.push(fullRender);
    expect(fullRender.read().hover).toEqual({
      scale: 1.02,
      transition: { type: 'spring', stiffness: 400, damping: 15 }
    });
  });

  it('counts up immediately when disabled and animates when enabled', () => {
    const disabledRender = renderHookValue(() => useCountUp(12, 1200, false));
    renders.push(disabledRender);
    expect(disabledRender.read()).toBe(12);

    const animatedRender = renderHookValue(() => useCountUp(10, 64, true));
    renders.push(animatedRender);
    expect(animatedRender.read()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(animatedRender.read()).toBe(10);
  });
});
