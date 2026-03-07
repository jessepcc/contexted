import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { apiRequest } from '../api.js';
import { Button } from '../components/Button.js';
import { PageShell } from '../components/PageShell.js';
import { useReducedMotion, useSpring, staggerItem } from '../hooks/useDelight.js';
import { shareOrCopy } from '../share.js';
import type { MatchResponse } from '../types.js';

type FeedbackStatus = 'idle' | 'submitting' | 'submitted' | 'error';

export function ExpiredPage(): ReactElement {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const spring = useSpring(reduced);

  useEffect(() => {
    apiRequest<MatchResponse>('/v1/matches/current')
      .then((res) => {
        setMatchId(res.match_id);
      })
      .catch(() => {});
  }, []);

  const submitFeedback = useCallback(
    async (rating: number) => {
      if (!matchId) return;
      setSelectedRating(rating);
      setFeedbackStatus('submitting');
      try {
        await apiRequest(`/v1/matches/${matchId}/feedback`, {
          method: 'POST',
          body: JSON.stringify({ rating })
        });
        setFeedbackStatus('submitted');
      } catch (reason) {
        setFeedbackStatus('error');
      }
    },
    [matchId]
  );

  const handleShare = useCallback(async () => {
    try {
      const result = await shareOrCopy({
        title: 'Contexted',
        text: 'I’m trying Contexted — it matches people from the memory their AI keeps instead of swipes.',
        url: window.location.origin
      });
      setShareStatus(
        result === 'copied'
          ? 'Invite link copied.'
          : result === 'shared'
            ? 'Invite sheet opened.'
            : null
      );
    } catch (error) {
      setShareStatus('Sharing is unavailable on this device.');
    }
  }, []);

  return (
    <PageShell blobs="expired">
      <div className="flex flex-col items-center gap-8 px-6 pb-10 pt-16">
        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-full border border-border-default bg-bg-card"
          {...spring.pop}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          {...(reduced ? {} : staggerItem(0))}
        >
          <h1 className="font-heading text-[28px] font-bold tracking-tight text-text-primary">
            The window closed, but the experiment keeps learning
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-text-secondary">
            This chat window closed, but your feedback still helps us sharpen how memory gets matched next time.
          </p>
        </motion.div>

        {matchId && feedbackStatus !== 'submitted' ? (
          <motion.section
            className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border-default bg-bg-card p-5"
            {...(reduced ? {} : staggerItem(1))}
          >
            <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">
              HOW DID IT FEEL?
            </span>
            <div role="radiogroup" aria-label="Rate the match" className="flex flex-wrap items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selectedRating === n}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-3xl transition-colors"
                  onClick={() => submitFeedback(n)}
                  disabled={feedbackStatus === 'submitting'}
                  aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                  whileHover={reduced ? undefined : { scale: 1.12 }}
                  whileTap={reduced ? undefined : { scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  {selectedRating !== null && n <= selectedRating ? (
                    <span className="text-accent-ink">&#9733;</span>
                  ) : (
                    <span className="text-border-strong">&#9734;</span>
                  )}
                </motion.button>
              ))}
            </div>
            <p className="text-center text-sm text-text-secondary">
              A quick score helps the memory experiment get sharper for the next drop.
            </p>
            {feedbackStatus === 'error' ? (
              <p role="alert" className="text-sm text-negative">
                Failed to submit feedback.
              </p>
            ) : null}
          </motion.section>
        ) : null}

        {feedbackStatus === 'submitted' ? (
          <motion.p className="font-medium text-positive-ink" {...spring.pop}>
            Thanks for the honest read.
          </motion.p>
        ) : null}

        <motion.section
          className="flex w-full flex-col gap-4 rounded-2xl border border-border-default bg-bg-card p-5"
          {...(reduced ? {} : staggerItem(2))}
        >
          <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">NEXT STEP</span>
          <p className="font-heading text-base font-semibold text-text-primary">
            Your memory rolls into the next batch automatically.
          </p>
          <p className="text-sm leading-relaxed text-text-secondary">
            No need to re-enter anything. When the next drop is ready, we’ll bring you back in.
          </p>
          <div className="rounded-xl bg-positive-soft px-4 py-3 text-sm text-positive-ink">
            Closing a chat does not reset your place in line.
          </div>
        </motion.section>

        <motion.div
          className="flex w-full flex-col gap-3"
          {...(reduced ? {} : staggerItem(3))}
        >
          <Button
            className="w-full"
            onClick={() => {
              window.location.href = '/app/waiting';
            }}
          >
            Back to the waiting room
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => void handleShare()}>
            Invite someone else in
          </Button>
          {shareStatus ? (
            <p className="text-center text-sm text-positive-ink" role="status">
              {shareStatus}
            </p>
          ) : null}
        </motion.div>
      </div>
    </PageShell>
  );
}
