import { redactSensitiveText } from '@contexted/shared';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button.js';
import { PageShell } from '../components/PageShell.js';
import { useReducedMotion } from '../hooks/useDelight.js';
import type { IntakeProvider } from '../intakeDraft.js';
import { loadIntakeDraft, saveIntakeDraft, saveLastIntakePreview } from '../intakeDraft.js';
import { buildMemoryReview, buildPreviewSnapshot } from '../memoryReview.js';
import { getInviteCodeFromSearch, savePendingInviteCode, trackInviteClick } from '../referrals.js';

const MEMORY_EXPORT_PROMPT =
  'Help me prepare a reviewed excerpt from your memory about me for a compatibility experiment. Exclude or replace anything directly identifying before you print it: names, employers, exact locations, family names, usernames, email addresses, phone numbers, government IDs, financial details, API keys, passwords, and private credentials. Keep the recurring themes, values, interests, habits, projects, and the tone of how I think. If something feels too identifying, summarize it instead of quoting it verbatim. Return only a concise excerpt inside a single code block.';

const steps = [
  {
    num: '01',
    title: 'Open your AI memory',
    desc: 'Claude gets a direct import-memory link. ChatGPT gets the export path. Start with the memory layer, not a profile.'
  },
  {
    num: '02',
    title: 'Review the excerpt before you paste it',
    desc: 'Treat this like a manual privacy pass. Bring the part that feels true right now, not the entire archive.'
  },
  {
    num: '03',
    title: 'Join the next alpha drop',
    desc: 'Verify your email, set preferences, and join the next alpha drop.'
  }
];

const DEFAULT_PROVIDER: IntakeProvider = 'other';
const DEFAULT_PROVIDER_LABEL = 'AI memory';

export function LandingPage(): ReactElement {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const initialDraft = useMemo(() => loadIntakeDraft(), []);
  const inviteCode = useMemo(() => getInviteCodeFromSearch(window.location.search), []);
  const [summaryText, setSummaryText] = useState(initialDraft?.summaryText ?? '');
  const [promptCopied, setPromptCopied] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(initialDraft?.reviewConfirmed ?? false);

  const review = useMemo(() => buildMemoryReview(summaryText), [summaryText]);
  const canContinue = summaryText.trim().length > 0 && reviewConfirmed;

  const fadeUp = (delay: number) =>
    reduced
      ? {}
      : {
        initial: { opacity: 0, y: 20 } as const,
        animate: { opacity: 1, y: 0 } as const,
        transition: { type: 'spring' as const, stiffness: 200, damping: 20, delay }
      };

  // Supabase may redirect magic links to `/` instead of `/auth/verify` if the
  // verify URL isn't in the project's allowed redirect list. Forward the hash so
  // VerifyPage can consume the token.
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      window.location.replace(`/auth/verify${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (!inviteCode) {
      return;
    }

    savePendingInviteCode(inviteCode);
    void trackInviteClick(inviteCode);
  }, [inviteCode]);

  function handleContinue(): void {
    if (!canContinue) {
      return;
    }

    const redacted = redactSensitiveText(summaryText).text;
    saveLastIntakePreview(buildPreviewSnapshot(review, DEFAULT_PROVIDER, DEFAULT_PROVIDER_LABEL));

    saveIntakeDraft({
      summaryText: redacted,
      provider: DEFAULT_PROVIDER,
      providerLabel: DEFAULT_PROVIDER_LABEL,
      reviewConfirmed
    });
    void navigate({ to: '/auth/login' });
  }

  return (
    <PageShell blobs="landing">
      <section className="px-4 pb-14 pt-6 sm:px-6 sm:pt-8 md:pb-16 lg:px-8 lg:pt-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <motion.div className="flex items-center justify-between" {...fadeUp(0)}>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold tracking-tight text-text-primary sm:text-xl">Contexted</span>
              <p className="text-[11px] tracking-wide text-text-secondary sm:text-xs">Matching with your AI's memory</p>
            </div>
            <span className="rounded-full border border-border-default bg-bg-card px-4 py-2 text-[10px] font-bold tracking-[0.18em] text-text-muted sm:text-[11px]">
              ALPHA
            </span>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 md:items-start md:gap-8 lg:gap-10 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.9fr)] xl:gap-12">
            <div className="flex flex-col gap-6 md:gap-8">
              {inviteCode ? (
                <motion.div
                  className="flex max-w-2xl flex-col gap-2 rounded-[24px] border border-accent/20 bg-accent-soft/70 px-5 py-4 text-left"
                  {...fadeUp(0.03)}
                >
                  <span className="text-[11px] font-bold tracking-[0.18em] text-accent-ink">PRIVATE INVITE</span>
                  <p className="font-heading text-lg font-semibold text-text-primary">A private invite brought you here.</p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    If this feels like your kind of experiment, keep going. We&rsquo;ll carry the link quietly through sign-in.
                  </p>
                </motion.div>
              ) : null}
              <motion.div className="flex flex-col gap-5" {...fadeUp(0.06)}>
                <h1 className="max-w-4xl font-heading text-[clamp(3rem,9vw,5.4rem)] font-bold leading-[0.92] tracking-[-0.045em] text-text-primary xl:text-[clamp(3.6rem,7.6vw,6rem)]">
                  Bring AI's memory about you
                  <span className="mt-2 block text-accent-ink">Look for a similar soul</span>
                </h1>
              </motion.div>

              <motion.div className="flex flex-wrap gap-x-4 gap-y-3 text-sm text-text-secondary md:gap-x-6" {...fadeUp(0.1)}>
                <span>Batch-matched, twice a week.</span>
                <span>Memory changes, so future drops can too.</span>
              </motion.div>

              <motion.div className="flex flex-col gap-3" {...fadeUp(0.18)}>
                <div className="flex flex-col border-t border-border-default">
                  {steps.map((step) => (
                    <div
                      key={step.num}
                      className="grid gap-3 border-b border-border-default py-4 md:grid-cols-[60px_minmax(0,1fr)]"
                    >
                      <span className="font-heading text-sm font-bold text-accent-ink">{step.num}</span>
                      <div className="min-w-0">
                        <h2 className="font-heading text-lg font-semibold text-text-primary">{step.title}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              <p className="max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
                Contexted is an alpha test of the social value of AI memory: not your polished profile,
                but the living context your assistant accumulates over time. Because that memory keeps
                changing, the experiment changes with it.
              </p>
            </div>

            <motion.section
              className="flex flex-col gap-5 rounded-[30px] border border-border-strong p-4 sm:p-5 md:sticky md:top-6 md:gap-6 md:p-6 xl:top-8"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 249, 243, 0.95) 0%, rgba(255, 249, 243, 0.82) 100%)',
                boxShadow: '0 32px 80px -52px rgba(38, 24, 20, 0.45)'
              }}
              {...fadeUp(0.12)}
            >
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">START WITH MEMORY</span>
                <p className="text-sm leading-relaxed text-text-secondary">
                  Find where your AI memory lives, then paste the export or excerpt you want this alpha to test.
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-[28px] border border-border-default bg-bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-accent-ink">
                    STEP 1
                  </span>
                  <p className="font-heading text-lg font-semibold text-text-primary">
                    Copy and paste the provided prompt into a chat with any AI provider.
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-text-secondary">
                  Prompt referenced from{' '}
                  <a
                    href="https://claude.com/import-memory"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent-ink underline decoration-accent/30 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent/60"
                  >
                    Anthropic&rsquo;s Claude Import Memory
                  </a>
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">PROMPT</span>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-default px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent-ink"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(MEMORY_EXPORT_PROMPT)
                        .then(() => {
                          setPromptCopied(true);
                          setTimeout(() => setPromptCopied(false), 2000);
                        })
                        .catch(() => {
                          setPromptCopied(false);
                        });
                    }}
                  >
                    {promptCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="relative">
                  <div
                    className="max-h-[4.5em] overflow-y-auto rounded-[20px] border border-border-default px-4 py-3"
                    style={{ background: 'color-mix(in srgb, var(--color-bg-card) 78%, var(--color-bg-elevated))' }}
                  >
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {MEMORY_EXPORT_PROMPT}
                    </p>
                  </div>
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-[20px]"
                    style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--color-bg-card) 78%, var(--color-bg-elevated)), transparent)' }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-[28px] border border-border-default bg-bg-card p-4 md:p-5">
                <div className="flex flex-col gap-1">
                  <span className="w-fit rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-accent-ink">
                    STEP 2
                  </span>
                  <p className="font-heading text-lg font-semibold text-text-primary">
                    Paste the full memory dump.
                  </p>
                </div>

                <div className="flex flex-col gap-2">

                  <textarea
                    id="memory-text"
                    className="min-h-44 w-full rounded-[24px] border border-border-default bg-bg-card px-4 py-4 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none md:min-h-52 md:rounded-[26px]"
                    placeholder="Paste the full memory dump you want this alpha to read..."
                    value={summaryText}
                    onChange={(event) => {
                      setSummaryText(event.target.value);
                      if (reviewConfirmed) {
                        setReviewConfirmed(false);
                      }
                    }}
                  />
                </div>

                <div
                  className="rounded-[24px] border border-border-default p-4"
                  style={{ background: 'color-mix(in srgb, var(--color-bg-card) 74%, var(--color-bg-elevated))' }}
                >
                  <span className="block text-[12px] font-bold tracking-[0.18em] text-text-muted">MANUAL REVIEW REQUIRED</span>
                  <ul className="mt-3 flex flex-col gap-3">
                    {review.manualReviewItems.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {review.alerts.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-3">
                      {review.alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`rounded-[18px] border px-4 py-3 ${alert.tone === 'negative'
                            ? 'border-negative/25 bg-negative-soft/70 text-negative'
                            : 'border-accent/18 bg-accent-soft/70 text-accent-ink'
                            }`}
                        >
                          <p className="text-sm font-semibold">{alert.title}</p>
                          <p className="mt-1 text-sm leading-relaxed">{alert.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <label className="flex items-start gap-3 rounded-[18px] border border-border-default bg-bg-card px-4 py-3 text-sm leading-relaxed text-text-primary">
                      <input
                        type="checkbox"
                        checked={reviewConfirmed}
                        onChange={(event) => setReviewConfirmed(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-border-strong text-accent focus:ring-0"
                      />
                      <span>
                        I reviewed this excerpt myself. I removed names, employers, exact locations, family details,
                        and secrets, and I understand Contexted stores derived matching text for this alpha.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button type="button" onClick={handleContinue} disabled={!canContinue} className="w-full">
                  Continue to email
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate({ to: '/app' })} className="w-full">
                  Returning user
                </Button>
              </div>
            </motion.section>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
