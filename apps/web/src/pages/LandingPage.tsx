import { useNavigate } from '@tanstack/react-router';
import { motion } from 'motion/react';
import type { CSSProperties, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '../components/Button.js';
import { PageShell } from '../components/PageShell.js';
import { useReducedMotion } from '../hooks/useDelight.js';
import type { IntakeProvider } from '../intakeDraft.js';
import { loadIntakeDraft, saveIntakeDraft } from '../intakeDraft.js';

const steps = [
  {
    num: '01',
    title: 'Open your AI memory',
    desc: 'Claude gets a direct import-memory link. ChatGPT gets the export path. Start with the memory layer, not a profile.'
  },
  {
    num: '02',
    title: 'Paste the memory that feels true right now',
    desc: 'Bring the living context — export, excerpt, or memory snapshot — you want matched on in this moment.'
  },
  {
    num: '03',
    title: 'Join the next alpha drop',
    desc: 'Verify your email, set preferences, and we test whether evolving AI memory can surface a similar soul.'
  }
];

const PROVIDERS: Array<{ id: IntakeProvider; label: string }> = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'other', label: 'Other' }
];

const CHATGPT_TUTORIAL_STEPS = [
  { label: 'Settings', detail: 'open the menu' },
  { label: 'Personalization', detail: 'find memory controls' },
  { label: 'Memory', detail: 'open your saved context' },
  { label: 'Export', detail: 'grab the current memory' }
] as const;

function getSelectedProviderStyle(provider: IntakeProvider): CSSProperties {
  switch (provider) {
    case 'chatgpt':
      return {
        borderColor: 'var(--color-chatgpt)',
        background: 'color-mix(in srgb, var(--color-chatgpt) 14%, var(--color-bg-card))',
        color: 'var(--color-chatgpt-contrast)'
      };
    case 'claude':
      return {
        borderColor: 'var(--color-accent)',
        background: 'var(--color-accent-soft)',
        color: 'var(--color-accent-ink)'
      };
    default:
      return {
        borderColor: 'var(--color-purple)',
        background: 'var(--color-purple-soft)',
        color: 'var(--color-text-primary)'
      };
  }
}

function ChatGptTutorialPreview({ reduced }: { reduced: boolean }): ReactElement {
  return (
    <div className="rounded-[26px] border border-border-default bg-bg-card p-4">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.18em] text-text-muted">
        <span>MEMORY EXPORT PATH</span>
        <span>Quick path</span>
      </div>

      <div
        className="relative mt-3 overflow-hidden rounded-[22px] border border-border-default p-2"
        style={{ background: 'color-mix(in srgb, var(--color-bg-card) 78%, var(--color-bg-elevated))' }}
      >
        <motion.div
          className="pointer-events-none absolute left-2 right-2 top-2 h-11 rounded-[18px] border border-transparent bg-accent-soft"
          animate={reduced ? undefined : { y: [0, 48, 96, 144, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute left-4 top-[21px] h-2.5 w-2.5 rounded-full bg-accent"
          animate={reduced ? undefined : { y: [0, 48, 96, 144, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {CHATGPT_TUTORIAL_STEPS.map((step) => (
          <div key={step.label} className="relative z-10 flex h-12 items-center justify-between rounded-[18px] px-4">
            <span className="text-sm font-semibold text-text-primary">{step.label}</span>
            <span className="text-xs text-text-secondary">{step.detail}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-text-secondary">
        Settings <span aria-hidden>&rarr;</span> Personalization <span aria-hidden>&rarr;</span> Memory{' '}
        <span aria-hidden>&rarr;</span> Export. Grab the export, then paste the section you want this alpha to read.
      </p>
    </div>
  );
}

export function LandingPage(): ReactElement {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const initialDraft = useMemo(() => loadIntakeDraft(), []);
  const [summaryText, setSummaryText] = useState(initialDraft?.summaryText ?? '');
  const [provider, setProvider] = useState<IntakeProvider>(initialDraft?.provider ?? 'chatgpt');
  const [providerLabel, setProviderLabel] = useState(initialDraft?.providerLabel ?? '');

  const canContinue =
    summaryText.trim().length > 0 && (provider !== 'other' || providerLabel.trim().length > 0);

  const fadeUp = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 20 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { type: 'spring' as const, stiffness: 200, damping: 20, delay }
        };

  function handleContinue(): void {
    if (!canContinue) {
      return;
    }

    saveIntakeDraft({
      summaryText,
      provider,
      providerLabel: provider === 'other' ? providerLabel : ''
    });
    void navigate({ to: '/auth/login' });
  }

  return (
    <PageShell blobs="landing">
      <section className="px-6 pb-16 pt-8 md:pt-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <motion.div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between" {...fadeUp(0)}>
            <div className="flex items-center gap-4">
              <div className="relative h-11 w-11">
                <div className="absolute inset-0 rounded-[18px] border border-border-default bg-bg-card" />
                <div
                  className="absolute left-0 top-0 h-7 w-7 rounded-[16px]"
                  style={{ background: 'color-mix(in srgb, var(--color-chatgpt) 70%, white)' }}
                />
                <div
                  className="absolute bottom-0 right-0 h-6 w-6 rounded-[14px]"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 82%, white)' }}
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-[26px] font-bold tracking-tight text-text-primary">Contexted</span>
                <span className="text-sm text-text-secondary">Words over faces. Memory over polish.</span>
              </div>
            </div>

            <span className="self-start rounded-full border border-border-default bg-bg-card px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-text-muted">
              ALPHA · LIVING MEMORY EXPERIMENT
            </span>
          </motion.div>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.92fr)] lg:items-start">
            <div className="flex flex-col gap-8">
              <motion.div className="flex flex-col gap-5" {...fadeUp(0.06)}>
                <h1 className="max-w-4xl font-heading text-[clamp(3rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.045em] text-text-primary">
                  Bring the memory your AI keeps about you.
                  <span className="mt-2 block text-accent-ink">We’ll look for a similar soul.</span>
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
                  Contexted is an alpha test of the social value of AI memory: not your polished profile,
                  but the living context your assistant accumulates over time. Because that memory keeps
                  changing, the experiment changes with it.
                </p>
              </motion.div>

              <motion.div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-text-secondary" {...fadeUp(0.1)}>
                <span>Batch-matched, twice a week.</span>
                <span>Memory changes, so future drops can too.</span>
                <span>Built for people who think in writing.</span>
              </motion.div>

              <motion.div
                className="max-w-2xl border-l border-border-strong pl-5 text-[15px] leading-relaxed text-text-primary"
                {...fadeUp(0.14)}
              >
                This is not a better profile form. It’s a test of whether the memory layer you build with an
                assistant can reveal kinship with less performance, less vanity, and more signal.
              </motion.div>

              <motion.div className="flex flex-col gap-3" {...fadeUp(0.18)}>
                <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">THE EXPERIMENT</span>

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
            </div>

            <motion.section
              className="flex flex-col gap-6 rounded-[32px] border border-border-strong p-5 md:p-6 lg:sticky lg:top-8"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 249, 243, 0.95) 0%, rgba(255, 249, 243, 0.82) 100%)',
                boxShadow: '0 32px 80px -52px rgba(38, 24, 20, 0.45)'
              }}
              {...fadeUp(0.12)}
            >
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">START WITH MEMORY</span>
                <p className="text-sm leading-relaxed text-text-secondary">
                  Choose where your AI memory lives, then paste the export or excerpt you want this alpha to test.
                </p>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="text-[12px] font-bold tracking-[0.18em] text-text-muted">WHERE YOUR MEMORY LIVES</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Memory provider">
                  {PROVIDERS.map((item) => {
                    const selected = provider === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setProvider(item.id)}
                        className="min-h-11 rounded-full border border-border-default bg-bg-card px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-accent"
                        style={selected ? getSelectedProviderStyle(item.id) : undefined}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {provider === 'other' ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="provider-label" className="text-sm font-medium text-text-primary">
                    Which assistant?
                  </label>
                  <input
                    id="provider-label"
                    type="text"
                    value={providerLabel}
                    onChange={(event) => setProviderLabel(event.target.value)}
                    placeholder="For example, Gemini"
                    className="min-h-12 w-full rounded-[18px] border border-border-default bg-bg-card px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-4 rounded-[28px] border border-border-default bg-bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-accent-ink">
                    STEP 1
                  </span>
                  <p className="font-heading text-lg font-semibold text-text-primary">
                    {provider === 'claude'
                      ? 'Visit claude.com/import-memory'
                      : provider === 'chatgpt'
                        ? 'Export your ChatGPT memory'
                        : `Open ${providerLabel.trim() || 'your assistant'} memory`}
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-text-secondary">
                  {provider === 'claude'
                    ? 'Claude has the cleanest path for this alpha: open import-memory, generate the memory view you want to test, then paste the section that feels most true right now.'
                    : provider === 'chatgpt'
                      ? 'ChatGPT hides the right control in settings. Use the export path below, then bring the part of your memory that actually sounds like you.'
                      : 'If your assistant keeps persistent memory, paste the part you would trust to represent your current self — not a cleaned-up bio.'}
                </p>

                {provider === 'claude' ? (
                  <>
                    <div
                      className="flex items-center gap-3 rounded-[22px] border border-border-default px-4 py-3"
                      style={{ background: 'color-mix(in srgb, var(--color-bg-card) 68%, var(--color-bg-elevated))' }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-positive" aria-hidden />
                      <span className="text-sm font-medium text-text-primary">https://claude.com/import-memory</span>
                    </div>

                    <a
                      href="https://claude.com/import-memory"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-12 items-center justify-center rounded-[20px] border border-accent bg-accent px-4 py-3 font-heading text-sm font-semibold text-accent-contrast transition-transform hover:-translate-y-0.5"
                    >
                      Open Claude memory import
                    </a>
                  </>
                ) : provider === 'chatgpt' ? (
                  <ChatGptTutorialPreview reduced={reduced} />
                ) : (
                  <div
                    className="rounded-[22px] border border-border-default px-4 py-4 text-sm leading-relaxed text-text-secondary"
                    style={{ background: 'color-mix(in srgb, var(--color-bg-card) 68%, var(--color-bg-elevated))' }}
                  >
                    Look for any memory or persistent-context export. The point of Contexted is the memory
                    your assistant already holds onto — the stuff that keeps changing as you use it.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="memory-text" className="text-[12px] font-bold tracking-[0.18em] text-text-muted">
                  MEMORY FOR MATCHING
                </label>
                <p id="memory-help" className="text-sm leading-relaxed text-text-secondary">
                  Paste the memory you want matched on. We read it for recurring threads, then discard the raw text
                  after processing.
                </p>
                <textarea
                  id="memory-text"
                  className="min-h-52 w-full rounded-[26px] border border-border-default bg-bg-card px-4 py-4 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  placeholder="Paste the memory your AI has built with you — export, excerpt, or import-memory result…"
                  value={summaryText}
                  aria-describedby="memory-help"
                  onChange={(event) => setSummaryText(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button type="button" onClick={handleContinue} disabled={!canContinue} className="w-full">
                  Continue to email
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate({ to: '/app' })} className="w-full">
                  Returning user
                </Button>

                <div className="flex flex-col gap-2 text-sm leading-relaxed">
                  {!canContinue ? (
                    <p className="text-text-secondary">Paste a memory export or excerpt to unlock the next step.</p>
                  ) : null}
                  <p className="text-text-secondary">
                    Alpha note: your AI memory is alive and changing. Future drops can shift as your context shifts.
                  </p>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
