import type { ReactElement } from 'react';

type SnapshotAlert = {
  tone: 'warning' | 'negative';
  title: string;
  message: string;
};

function toneClasses(tone: SnapshotAlert['tone']): string {
  return tone === 'negative'
    ? 'border-negative/30 bg-negative-soft/70 text-negative'
    : 'border-warning/20 text-accent-ink';
}

export function ProfileSnapshotCard({
  eyebrow,
  title,
  providerLabel,
  summary,
  vibeCheck,
  signals,
  alerts = [],
  footer,
  tone = 'live'
}: {
  eyebrow: string;
  title: string;
  providerLabel: string;
  summary: string;
  vibeCheck?: string | null;
  signals?: string[];
  alerts?: SnapshotAlert[];
  footer?: string;
  tone?: 'live' | 'preview';
}): ReactElement {
  const frameClasses = tone === 'live' ? 'border-accent/18' : 'border-border-default bg-bg-card';
  const frameStyle =
    tone === 'live'
      ? {
          background: 'linear-gradient(180deg, rgba(255, 249, 243, 0.98) 0%, rgba(255, 249, 243, 0.9) 100%)'
        }
      : undefined;

  return (
    <section className={`rounded-[28px] border p-5 lg:p-6 ${frameClasses}`} style={frameStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">{eyebrow}</span>
          <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
        </div>
        <span className="rounded-full border border-border-default bg-bg-card/90 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-text-secondary">
          {providerLabel}
        </span>
      </div>

      <div className="mt-4 rounded-[22px] border border-border-default bg-bg-card/90 p-4">
        <p className="text-sm leading-relaxed text-text-primary break-words">{summary}</p>
      </div>

      {signals && signals.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {signals.map((signal) => (
            <span
              key={signal}
              className="rounded-full border border-border-default bg-bg-card/90 px-3 py-1.5 text-xs font-medium capitalize tracking-[0.02em] text-text-secondary"
            >
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      {vibeCheck ? (
        <div className="mt-4 rounded-[22px] border border-accent/18 bg-accent-soft/65 p-4">
          <span className="text-[11px] font-bold tracking-[0.18em] text-accent-ink">VIBE CHECK</span>
          <p className="mt-2 text-sm leading-relaxed text-text-primary break-words">{vibeCheck}</p>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {alerts.map((alert) => (
            <div
              key={alert.title}
              className={`rounded-[18px] border px-4 py-3 ${toneClasses(alert.tone)}`}
              style={
                alert.tone === 'warning'
                  ? {
                      background: 'color-mix(in srgb, var(--color-accent-soft) 70%, var(--color-bg-card))'
                    }
                  : undefined
              }
            >
              <p className="text-sm font-semibold">{alert.title}</p>
              <p className="mt-1 text-sm leading-relaxed break-words">{alert.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {footer ? <p className="mt-4 text-sm leading-relaxed text-text-secondary">{footer}</p> : null}
    </section>
  );
}
