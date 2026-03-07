import type { ReactElement } from 'react';
import { useCountUp, useReducedMotion } from '../hooks/useDelight.js';

export function AnimatedNumber({
  value,
  duration = 1200,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}): ReactElement {
  const reduced = useReducedMotion();
  const displayed = useCountUp(value, duration, !reduced);
  return <span className={className}>{displayed}</span>;
}
