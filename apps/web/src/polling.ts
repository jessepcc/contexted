import { useEffect, useRef } from 'react';

export function usePolling(input: {
  enabled: boolean;
  intervalMs: number;
  backgroundIntervalMs: number;
  onTick: () => Promise<void> | void;
}): void {
  const activeRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    activeRef.current = true;

    async function run(): Promise<void> {
      if (!input.enabled || !activeRef.current) {
        return;
      }

      try {
        await input.onTick();
      } finally {
        if (!input.enabled || !activeRef.current) {
          return;
        }

        const hidden = document.visibilityState === 'hidden';
        const base = hidden ? input.backgroundIntervalMs : input.intervalMs;
        const jitter = Math.floor(Math.random() * 200);

        timeoutRef.current = window.setTimeout(run, base + jitter);
      }
    }

    timeoutRef.current = window.setTimeout(run, input.intervalMs);

    return () => {
      activeRef.current = false;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [input.enabled, input.intervalMs, input.backgroundIntervalMs, input.onTick]);
}
