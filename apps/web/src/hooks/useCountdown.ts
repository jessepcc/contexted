import { useEffect, useRef, useState } from 'react';

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function useCountdown(targetIso: string | null, serverNowIso: string): string | null {
  const skewRef = useRef(new Date(serverNowIso).getTime() - Date.now());
  const [display, setDisplay] = useState<string | null>(() => {
    if (!targetIso) return null;
    const remaining = new Date(targetIso).getTime() - (Date.now() + skewRef.current);
    return remaining > 0 ? formatRemaining(remaining) : null;
  });

  useEffect(() => {
    if (!targetIso) {
      setDisplay(null);
      return;
    }

    const targetMs = new Date(targetIso).getTime();
    const skew = skewRef.current;

    function tick() {
      const remaining = targetMs - (Date.now() + skew);
      setDisplay(remaining > 0 ? formatRemaining(remaining) : null);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return display;
}
