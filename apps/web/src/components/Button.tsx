import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '../hooks/useDelight.js';

type ButtonVariant = 'primary' | 'secondary' | 'chatgpt' | 'claude';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast',
  secondary: 'bg-bg-card border-[1.5px] border-border-strong text-text-primary',
  chatgpt: 'bg-chatgpt text-chatgpt-contrast',
  claude: 'bg-claude text-accent-contrast',
};

type MotionConflicts = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onDragOver';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, MotionConflicts> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps): ReactElement {
  const reduced = useReducedMotion();

  return (
    <motion.button
      className={`flex min-h-12 items-center justify-center rounded-lg px-8 py-4 font-heading text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled}
      whileHover={!disabled && !reduced ? { scale: 1.01, y: -1 } : undefined}
      whileTap={!disabled && !reduced ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
