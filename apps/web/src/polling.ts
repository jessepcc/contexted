import { useEffect, useRef } from 'react';

export function usePolling(input: {
  enabled: boolean;
  intervalMs: number;
  backgroundIntervalMs: number;
  onTick: () => Promise<void> | void;
}): void {
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    async function run(): Promise<void> {
      if (!input.enabled || !activeRef.current) {
        return;
      }

      try {
        await input.onTick();
      } finally {
        const hidden = document.visibilityState === 'hidden';
        const base = hidden ? input.backgroundIntervalMs : input.intervalMs;
        const jitter = Math.floor(Math.random() * 200);

        window.setTimeout(run, base + jitter);
      }
    }

    const timer = window.setTimeout(run, input.intervalMs);

    return () => {
      activeRef.current = false;
      window.clearTimeout(timer);
    };
  }, [input.enabled, input.intervalMs, input.backgroundIntervalMs, input.onTick]);
}
