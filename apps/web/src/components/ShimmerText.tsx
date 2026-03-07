import type { ReactElement } from 'react';

export function ShimmerText({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}): ReactElement {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--color-text-primary) 0%, var(--color-accent) 50%, var(--color-text-primary) 100%)',
      }}
    >
      {children}
    </span>
  );
}
