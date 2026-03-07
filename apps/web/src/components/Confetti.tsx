import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

const COLORS = [
  'var(--color-accent)',
  'color-mix(in srgb, var(--color-accent) 65%, var(--color-bg-card))',
  'color-mix(in srgb, var(--color-chatgpt) 45%, var(--color-bg-card))',
  'color-mix(in srgb, var(--color-purple) 40%, var(--color-bg-card))',
  'color-mix(in srgb, var(--color-accent) 35%, var(--color-bg-card))'
];
const PARTICLE_COUNT = 30;

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  drift: number;
  size: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 60,
    size: 4 + Math.random() * 6,
  }));
}

export function Confetti({ active }: { active: boolean }): ReactElement | null {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    setParticles(makeParticles());
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            '--confetti-drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
