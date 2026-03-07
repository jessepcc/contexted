import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useReducedMotion } from '../hooks/useDelight.js';

export function RotatingText({
  texts,
  intervalMs = 3500,
  className = '',
}: {
  texts: string[];
  intervalMs?: number;
  className?: string;
}): ReactElement {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (texts.length <= 1 || reduced) return;
    let timeout: number | undefined;
    const timer = window.setInterval(() => {
      setFading(true);
      timeout = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % texts.length);
        setFading(false);
      }, 300);
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [texts.length, intervalMs, reduced]);

  return (
    <span
      className={`inline-block transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'} ${className}`}
    >
      {texts[index]}
    </span>
  );
}
