import type { ReactElement } from 'react';
import { motion } from 'motion/react';
import { PageShell } from '../components/PageShell.js';
import { Button } from '../components/Button.js';
import { useReducedMotion, useSpring } from '../hooks/useDelight.js';

export function ErrorPage(): ReactElement {
  const reduced = useReducedMotion();
  const spring = useSpring(reduced);

  return (
    <PageShell blobs="landing">
      <motion.div
        className="flex flex-col items-center gap-6 px-6 pt-24"
        {...spring.enter}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>

        <h1 className="font-heading text-3xl font-bold text-text-primary text-center">
          The experiment hit a snag
        </h1>
        <p className="text-sm text-text-secondary text-center">
          Something slipped on our side while restoring your state. Try again and we’ll pick your thread back up.
        </p>
        <Button onClick={() => { window.location.href = '/app'; }} className="w-full">
          Reload my place
        </Button>
      </motion.div>
    </PageShell>
  );
}
