import { useNavigate } from '@tanstack/react-router';
import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, HttpError } from '../api.js';
import { useAppContext } from '../AppContext.js';
import { Button } from '../components/Button.js';
import { Confetti } from '../components/Confetti.js';
import { PageShell } from '../components/PageShell.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useReducedMotion } from '../hooks/useDelight.js';
import { usePolling } from '../polling.js';
import type { MatchResponse } from '../types.js';

export function RevealPage(): ReactElement {
  const navigate = useNavigate();
  const { appState } = useAppContext();
  const reduced = useReducedMotion();
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollInterval, setPollInterval] = useState(5000);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(
    match?.deadline_at ?? appState?.match?.deadline_at ?? null,
    appState?.serverNow ?? new Date().toISOString()
  );

  const load = useCallback(async () => {
    const current = await apiRequest<MatchResponse>('/v1/matches/current');
    setMatch(current);
    setPollInterval(current.poll_after_ms ?? 5000);
    if (current.state === 'unlocked') {
      navigate({ to: '/app/chat' });
    }
  }, [navigate]);

  useEffect(() => {
    void load()
      .then(() => setLoading(false))
      .catch((reason) => {
        if (reason instanceof HttpError && [404, 422].includes(reason.status)) {
          navigate({ to: '/app/waiting' });
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Failed to load your reveal.');
        setLoading(false);
      });
  }, [load, navigate]);

  usePolling({
    enabled: true,
    intervalMs: pollInterval,
    backgroundIntervalMs: 30000,
    onTick: async () => {
      await load();
    }
  });

  const submit = useCallback(async () => {
    if (!match?.match_id) {
      return;
    }

    try {
      await apiRequest<{ state: string; version: number }>(`/v1/matches/${match.match_id}/confession`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': `confession-${match.match_id}-v${match.version}`
        },
        body: JSON.stringify({ answer, expected_version: match.version })
      });
      setAnswer('');
      await load();
    } catch (reason) {
      setError(reason instanceof HttpError ? reason.payload.message : 'Failed to send your opening note.');
    }
  }, [answer, load, match?.match_id, match?.version]);

  const spring = { type: 'spring' as const, stiffness: 200, damping: 20 };

  if (loading && !match) {
    return (
      <PageShell blobs="reveal">
        <div className="flex flex-col items-center gap-3 px-6 pt-24">
          <h1 className="font-heading text-2xl font-bold text-text-primary">Opening your reveal…</h1>
          <div className="h-8 w-8 rounded-full border-4 border-accent border-t-transparent animate-spin" aria-hidden="true" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell blobs="reveal">
      {/* Confetti when synergy points are loaded */}
      <Confetti active={!reduced && (match?.synergy_points?.length ?? 0) > 0} />

      {/* Warm light bloom behind content */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, transparent 70%)',
          opacity: reduced ? 1 : undefined,
        }}
      >
        {!reduced && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              background:
                'radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, transparent 70%)',
            }}
          />
        )}
      </div>

      <motion.div
        className="relative z-10 px-6 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8"
        {...(reduced
          ? {}
          : {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.8, ease: 'easeOut' },
            })}
      >
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] md:items-start md:gap-6 lg:gap-8">
          <div className="flex flex-col gap-5 md:sticky md:top-8">
            <motion.div
              className="flex flex-col items-center gap-2 text-center md:items-start md:text-left"
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { ...spring, delay: 0.1 },
                  })}
            >
              <h1 className="font-heading text-[28px] font-bold tracking-tight text-text-primary md:text-[32px] lg:text-[34px]">
                A similar soul surfaced.
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
                Here&rsquo;s where your memories rhymed.
              </p>
            </motion.div>

            {countdown ? (
              <motion.div
                className="flex items-center justify-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 md:justify-start"
                {...(reduced
                  ? {}
                  : {
                      initial: { opacity: 0, scale: 0.95 },
                      animate: { opacity: 1, scale: 1 },
                      transition: { ...spring, delay: 0.2 },
                    })}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-accent-ink"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-[13px] font-semibold text-accent-ink">
                  Take your time. {countdown} to answer before the note unlocks.
                </span>
              </motion.div>
            ) : null}

            <motion.section
              className="rounded-[28px] border border-border-default bg-bg-card p-5 lg:p-6"
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { ...spring, delay: 0.28 },
                  })}
            >
              <span className="text-[12px] font-bold tracking-[0.18em] text-accent-ink">FIRST READ</span>
              <p className="mt-3 font-heading text-base font-semibold text-text-primary">
                A few shared threads are already clear.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                These are the early patterns that made this introduction feel worth surfacing.
              </p>
            </motion.section>
          </div>

          <div className="flex flex-col gap-5 md:pt-2">
            <motion.section
              className="rounded-[28px] border border-border-default bg-bg-card p-5 lg:p-6"
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 24 },
                    animate: { opacity: 1, y: 0 },
                    transition: { ...spring, delay: 0.35 },
                  })}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold tracking-[0.18em] text-positive-ink">
                  WHERE YOUR MEMORIES RHYMED
                </span>
                <p className="text-sm leading-relaxed text-text-secondary">
                  These are the recurring notes the system found across both memory trails.
                </p>
              </div>

              {match?.synergy_points?.length ? (
                <div className="mt-5 flex flex-col gap-4">
                  {match.synergy_points.map((point, index) => (
                    <motion.div
                      key={point}
                      className={`flex gap-3 ${index === 0 ? '' : 'border-t border-border-default pt-4'}`}
                      {...(reduced
                        ? {}
                        : {
                            initial: { opacity: 0, y: 16 },
                            animate: { opacity: 1, y: 0 },
                            transition: { ...spring, delay: 0.42 + index * 0.12 },
                          })}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-positive-soft text-[11px] font-semibold text-positive-ink">
                        {index + 1}
                      </span>
                      <p className="pt-1 text-sm leading-relaxed text-text-primary">{point}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm leading-relaxed text-text-muted">We&rsquo;re still writing this reveal.</p>
              )}
            </motion.section>

            <motion.section
              className="rounded-[28px] border border-accent bg-bg-card p-5 lg:p-6"
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 24 },
                    animate: { opacity: 1, y: 0 },
                    transition: { ...spring, delay: 0.5 },
                  })}
            >
              <span className="text-[12px] font-bold tracking-[0.18em] text-accent-ink">YOUR OPENING NOTE</span>

              {match?.confession_prompt ? (
                <>
                  <p className="mt-3 font-heading text-lg font-bold leading-snug text-text-primary">
                    {match.confession_prompt}
                  </p>
                  <label htmlFor="confession-answer" className="mt-4 block text-sm font-medium text-text-primary">
                    What do you want them to know first?
                  </label>
                  <p id="confession-help" className="mt-2 text-sm leading-relaxed text-text-secondary">
                    You both answer. The conversation unlocks at the same moment.
                  </p>
                  <textarea
                    id="confession-answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    rows={5}
                    placeholder="Write the first thing that feels true to say."
                    aria-describedby="confession-help"
                    className="mt-3 min-h-[8.5rem] w-full resize-none rounded-2xl border border-border-default bg-bg-deep p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
                      A warm first note beats a polished one. Words over performance.
                    </p>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={submit}
                      type="button"
                      disabled={answer.trim().length === 0}
                    >
                      Lock in my note
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  We&rsquo;re still composing the first prompt from your overlap. It will land here as soon as the
                  reveal package is ready.
                </p>
              )}

              {error ? (
                <p role="alert" className="mt-4 text-sm text-negative">
                  {error}
                </p>
              ) : null}
            </motion.section>
          </div>
        </div>
      </motion.div>
    </PageShell>
  );
}
