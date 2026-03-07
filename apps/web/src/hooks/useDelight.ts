import { useEffect, useRef, useState } from 'react';

// --- Reduced motion ---

function getReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

// --- Spring presets for motion ---

export const springPop = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 15 },
};

export const springEnter = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 200, damping: 20 },
};

export const springHover = {
  scale: 1.02,
  transition: { type: 'spring' as const, stiffness: 400, damping: 15 },
};

export const springPress = {
  scale: 0.97,
  transition: { type: 'spring' as const, stiffness: 500, damping: 15 },
};

// --- Stagger helper ---

export function staggerChildren(baseDelay: number = 0.1) {
  return {
    animate: { transition: { staggerChildren: baseDelay } },
  };
}

export function staggerItem(index: number, baseDelay: number = 0.1) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 20,
      delay: index * baseDelay,
    },
  };
}

// --- Animated count-up hook ---

export function useCountUp(
  target: number,
  duration: number = 1200,
  enabled: boolean = true
): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    startRef.current = null;

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return value;
}

// --- Reduced-motion-aware spring ---

export function useSpring(reduced: boolean) {
  return {
    pop: reduced
      ? { initial: {}, animate: {}, transition: { duration: 0 } }
      : springPop,
    enter: reduced
      ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : springEnter,
    hover: reduced ? {} : springHover,
    press: reduced ? {} : springPress,
  };
}
