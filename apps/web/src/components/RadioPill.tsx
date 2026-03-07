import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '../hooks/useDelight.js';

type MotionConflicts = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onDragOver';

export function RadioPill({
  label,
  selected,
  onClick,
  className = '',
  ...props
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | MotionConflicts>): ReactElement {
  const reduced = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-lg border px-5 py-3 text-[15px] font-medium transition-colors ${
        selected
          ? 'border-accent bg-accent text-accent-contrast'
          : 'border-border-default bg-bg-card text-text-primary hover:border-accent'
      } ${className}`}
      whileTap={!reduced ? { scale: 0.95 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      {...props}
    >
      {label}
    </motion.button>
  );
}
