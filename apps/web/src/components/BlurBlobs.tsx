import type { ReactElement } from 'react';
import { useReducedMotion } from '../hooks/useDelight.js';

interface Blob {
  color: string;
  width: string;
  height: string;
  left: string;
  top: string;
  blur: number;
}

const presets: Record<string, Blob[]> = {
  landing: [
    { color: 'color-mix(in srgb, var(--color-chatgpt) 14%, transparent)', width: '40%', height: '35%', left: '-5%', top: '5%', blur: 120 },
    { color: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', width: '35%', height: '30%', left: '55%', top: '35%', blur: 120 },
    { color: 'color-mix(in srgb, var(--color-purple) 10%, transparent)', width: '30%', height: '25%', left: '10%', top: '70%', blur: 100 },
  ],
  upload: [
    { color: 'color-mix(in srgb, var(--color-chatgpt) 12%, transparent)', width: '38%', height: '32%', left: '-5%', top: '10%', blur: 110 },
    { color: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', width: '35%', height: '28%', left: '50%', top: '55%', blur: 110 },
  ],
  processing: [
    { color: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', width: '42%', height: '35%', left: '5%', top: '8%', blur: 130 },
    { color: 'color-mix(in srgb, var(--color-chatgpt) 10%, transparent)', width: '32%', height: '28%', left: '-5%', top: '50%', blur: 110 },
  ],
  vibeCheck: [
    { color: 'color-mix(in srgb, var(--color-purple) 10%, transparent)', width: '38%', height: '30%', left: '-8%', top: '5%', blur: 120 },
    { color: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', width: '40%', height: '32%', left: '45%', top: '45%', blur: 120 },
  ],
  preferences: [
    { color: 'color-mix(in srgb, var(--color-chatgpt) 10%, transparent)', width: '36%', height: '30%', left: '45%', top: '3%', blur: 110 },
    { color: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', width: '34%', height: '28%', left: '-5%', top: '35%', blur: 110 },
  ],
  waiting: [
    { color: 'color-mix(in srgb, var(--color-purple) 8%, transparent)', width: '40%', height: '35%', left: '-8%', top: '5%', blur: 120 },
    { color: 'color-mix(in srgb, var(--color-chatgpt) 10%, transparent)', width: '36%', height: '30%', left: '55%', top: '40%', blur: 110 },
  ],
  reveal: [
    { color: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', width: '38%', height: '32%', left: '-5%', top: '8%', blur: 120 },
    { color: 'color-mix(in srgb, var(--color-chatgpt) 8%, transparent)', width: '34%', height: '28%', left: '50%', top: '50%', blur: 110 },
  ],
  expired: [
    { color: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', width: '38%', height: '32%', left: '30%', top: '5%', blur: 120 },
    { color: 'color-mix(in srgb, var(--color-purple) 8%, transparent)', width: '36%', height: '30%', left: '-5%', top: '55%', blur: 110 },
  ],
};

export function BlurBlobs({ variant }: { variant: keyof typeof presets }): ReactElement {
  const blobs = presets[variant] ?? presets.landing;
  const reduced = useReducedMotion();
  const shouldAnimate = !reduced && variant !== 'landing';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            background: b.color,
            width: b.width,
            height: b.height,
            left: b.left,
            top: b.top,
            filter: `blur(${b.blur}px)`,
            willChange: shouldAnimate ? 'transform' : undefined,
            animation: shouldAnimate
              ? `blob-drift 25s ease-in-out infinite ${i * 3}s, blob-breathe 8s ease-in-out infinite ${i * 2}s`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

export type BlobVariant = keyof typeof presets;
