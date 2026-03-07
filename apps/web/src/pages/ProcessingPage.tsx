import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { apiRequest } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { AnimatedNumber } from '../components/AnimatedNumber.js';
import { RotatingText } from '../components/RotatingText.js';
import { usePolling } from '../polling.js';
import { useReducedMotion } from '../hooks/useDelight.js';
import { clearActiveJobId, getActiveJobId } from '../intakeDraft.js';

const PRIVACY_STEPS = [
  'Names and specifics softened',
  'Memory excerpt mapped into themes',
  'Looking for resonance in this drop',
  'Raw data gone for good',
] as const;

const ROTATING_MESSAGES = [
  'Reading the memory you brought in...',
  'Looking for recurring threads...',
  'Checking for a similar soul...',
  'This alpha is still learning...',
  'Almost there...',
];

function getCompletedSteps(progress: number): number {
  if (progress >= 100) return 4;
  if (progress >= 75) return 3;
  if (progress >= 50) return 2;
  if (progress >= 25) return 1;
  return 0;
}

export function ProcessingPage(): ReactElement {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { jobId } = useSearch({ from: '/app/processing' });
  const resolvedJobId = jobId || getActiveJobId();
  const completionHandledRef = useRef(false);
  const [job, setJob] = useState<{ state: string; progress: number; poll_after_ms?: number } | null>(null);
  const [pollInterval, setPollInterval] = useState(2000);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!resolvedJobId) {
      setError('We couldn’t find your processing state.');
      return;
    }

    const response = await apiRequest<{ state: string; progress: number; poll_after_ms?: number }>(
      '/v1/ingest/jobs/' + resolvedJobId
    );
    setJob(response);
    setPollInterval(response.poll_after_ms ?? 2000);

    if (response.state === 'succeeded' && !completionHandledRef.current) {
      completionHandledRef.current = true;
      try {
        await apiRequest('/v1/waitlist/enroll', {
          method: 'POST',
          body: JSON.stringify({})
        });
        clearActiveJobId();
        navigate({ to: '/app/waiting' });
      } catch (reason) {
        completionHandledRef.current = false;
        throw reason;
      }
    }
  }, [resolvedJobId, navigate]);

  useEffect(() => {
    if (!resolvedJobId) {
      setError('We couldn’t find a live memory read. Please start again from the landing page.');
    }
  }, [resolvedJobId]);

  usePolling({
    enabled: Boolean(resolvedJobId) && !completionHandledRef.current,
    intervalMs: pollInterval,
    backgroundIntervalMs: 30000,
    onTick: async () => {
      try {
        await fetchJob();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'We couldn’t refresh your progress right now.');
      }
    }
  });

  const progress = job?.progress ?? 0;
  const completedSteps = getCompletedSteps(progress);

  return (
    <PageShell blobs="processing">
      <div className="flex flex-col items-center gap-10 px-6 pt-20 pb-10">
        <div className="relative h-[132px] w-[144px]">
          <motion.div
            className="absolute left-4 top-1 flex h-[78px] w-[92px] rotate-[-9deg] flex-col gap-2 rounded-[22px] border border-border-default bg-bg-card p-3 shadow-[0_18px_40px_-26px_rgba(38,24,20,0.4)]"
            animate={reduced ? undefined : { y: [0, -4, 0], rotate: [-9, -7, -9] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="h-2 w-14 rounded-full bg-chatgpt/25" />
            <span className="h-2 w-12 rounded-full bg-chatgpt/15" />
            <span className="h-2 w-10 rounded-full bg-chatgpt/12" />
          </motion.div>
          <motion.div
            className="absolute right-3 top-7 flex h-[82px] w-[98px] rotate-[7deg] flex-col gap-2 rounded-[24px] border border-border-default bg-bg-card p-3 shadow-[0_18px_40px_-26px_rgba(38,24,20,0.4)]"
            animate={reduced ? undefined : { y: [0, 3, 0], rotate: [7, 5, 7] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          >
            <span className="h-2 w-16 rounded-full bg-accent/28" />
            <span className="h-2 w-11 rounded-full bg-accent/16" />
            <span className="h-2 w-[3.25rem] rounded-full bg-accent/12" />
          </motion.div>
          <motion.div
            className="absolute bottom-0 left-7 flex h-[76px] w-[88px] rotate-[-2deg] flex-col gap-2 rounded-[22px] border border-border-default bg-bg-card p-3 shadow-[0_18px_40px_-26px_rgba(38,24,20,0.4)]"
            animate={reduced ? undefined : { y: [0, -2, 0], rotate: [-2, 0, -2] }}
            transition={{ duration: 8.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          >
            <span className="h-2 w-12 rounded-full bg-purple/22" />
            <span className="h-2 w-14 rounded-full bg-purple/14" />
            <span className="h-2 w-9 rounded-full bg-purple/10" />
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="font-heading text-[28px] font-bold text-center text-text-primary">
            <RotatingText texts={ROTATING_MESSAGES} intervalMs={3500} />
          </h1>
          <p className="text-sm text-text-secondary" aria-live="polite">
            We read the memory you brought in, map the themes, then drop the raw text.
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated"
            role="progressbar"
            aria-label="Memory processing progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${progress}% complete`}
          >
            <div
              className="relative h-full origin-left overflow-hidden rounded-full bg-accent will-change-transform"
              style={{ transform: `scaleX(${Math.max(progress, 2) / 100})` }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                style={{ backgroundSize: '200% 100%' }}
              />
            </div>
          </div>
          <span className="font-heading text-base font-bold text-text-primary">
            <AnimatedNumber value={progress} />%
          </span>
        </div>

        {/* Privacy timeline */}
        <div className="flex w-full flex-col gap-3">
          {PRIVACY_STEPS.map((label, i) => {
            const stepIndex = i + 1;
            const done = completedSteps >= stepIndex;
            const active = completedSteps === i && completedSteps < 4;

            let dotClass = 'h-2.5 w-2.5 rounded-full flex-shrink-0';
            if (done) {
              dotClass += ' bg-positive';
            } else if (active) {
              dotClass += ' bg-accent';
            } else {
              dotClass += ' bg-border-default';
            }

            return (
              <div key={label} className="flex items-center gap-3">
                <div className={dotClass}>
                  {done && (
                    <motion.svg
                      className="h-2.5 w-2.5 text-white"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      initial={reduced ? undefined : { opacity: 0, scale: 0.5 }}
                      animate={reduced ? undefined : { opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <path d="M2.5 5.5 L4.5 7.5 L7.5 3" />
                    </motion.svg>
                  )}
                </div>
                <span
                  className={
                    done
                      ? 'text-sm text-text-primary'
                      : active
                        ? 'text-sm text-text-secondary'
                        : 'text-sm text-text-muted'
                  }
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error display */}
        {error && (
          <p role="alert" className="text-center text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </PageShell>
  );
}
