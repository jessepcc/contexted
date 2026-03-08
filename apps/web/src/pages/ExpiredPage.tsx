import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { apiRequest } from '../api.js';
import { Button } from '../components/Button.js';
import { PageShell } from '../components/PageShell.js';
import { ReferralInviteCard } from '../components/ReferralInviteCard.js';
import { useReducedMotion, useSpring, staggerItem } from '../hooks/useDelight.js';
import {
  buildReferralShareContent,
  consumeReferralFlash,
  fetchReferralOverview
} from '../referrals.js';
import { copyToClipboard, shareOrCopy } from '../share.js';
import type { MatchResponse, ReferralOverviewResponse } from '../types.js';

type FeedbackStatus = 'idle' | 'submitting' | 'submitted' | 'error';

export function ExpiredPage(): ReactElement {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralOverviewResponse | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [referralFlash, setReferralFlash] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const spring = useSpring(reduced);

  useEffect(() => {
    setReferralFlash(consumeReferralFlash());
    apiRequest<MatchResponse>('/v1/matches/current')
      .then((res) => {
        setMatchId(res.match_id);
      })
      .catch(() => {});

    void fetchReferralOverview()
      .then((response) => {
        setReferral(response);
        setReferralError(null);
      })
      .catch(() => {
        setReferral(null);
        setReferralError('Private invites are warming up. Your place in line stays intact.');
      })
      .finally(() => {
        setLoadingReferral(false);
      });
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
    const shareContent = referral ? buildReferralShareContent(referral) : null;
    if (!shareContent) {
      setShareStatus('Private invite link unavailable right now.');
      return;
    }

    try {
      const result = await shareOrCopy(shareContent);
      setShareStatus(
        result === 'copied'
          ? 'Private invite copied.'
          : result === 'shared'
            ? 'Private share sheet opened.'
            : null
      );
    } catch (error) {
      setShareStatus('Sharing is unavailable on this device.');
    }
  }, [referral]);

  const handleCopy = useCallback(async () => {
    const shareContent = referral ? buildReferralShareContent(referral) : null;
    if (!shareContent) {
      setShareStatus('Private invite link unavailable right now.');
      return;
    }

    try {
      await copyToClipboard(shareContent);
      setShareStatus('Private invite copied.');
    } catch (error) {
      setShareStatus('Copy is unavailable on this device.');
    }
  }, [referral]);

  return (
    <PageShell blobs="expired">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-10 pt-12 sm:px-6 lg:grid lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8 lg:pt-16">
        <div className="flex flex-col items-center gap-6 text-center lg:sticky lg:top-8 lg:items-start lg:text-left">
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
            className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left"
            {...(reduced ? {} : staggerItem(0))}
          >
            <h1 className="font-heading text-[28px] font-bold tracking-tight text-text-primary lg:max-w-sm lg:text-[34px]">
              The window closed, but the experiment keeps learning
            </h1>
            <p className="max-w-lg text-[15px] leading-relaxed text-text-secondary">
              This chat window closed, but your feedback still helps us sharpen how memory gets matched next time.
            </p>
          </motion.div>
        </div>

        <div className="flex flex-col gap-5">
          {matchId && feedbackStatus !== 'submitted' ? (
            <motion.section
              className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border-default bg-bg-card p-5 lg:items-start lg:p-6"
              {...(reduced ? {} : staggerItem(1))}
            >
              <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">
                HOW DID IT FEEL?
              </span>
              <div role="radiogroup" aria-label="Rate the match" className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
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
              <p className="text-center text-sm text-text-secondary lg:text-left">
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
            className="flex w-full flex-col gap-4 rounded-2xl border border-border-default bg-bg-card p-5 lg:p-6"
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

          <motion.div className="flex w-full flex-col gap-3" {...(reduced ? {} : staggerItem(3))}>
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = '/app/waiting';
              }}
            >
              Back to the waiting room
            </Button>
          </motion.div>

          <motion.div {...(reduced ? {} : staggerItem(4))}>
            <ReferralInviteCard
              referral={referral}
              shareStatus={shareStatus}
              loading={loadingReferral}
              error={referralError}
              flashMessage={referralFlash}
              onCopy={handleCopy}
              onShare={handleShare}
            />
          </motion.div>
        </div>
      </div>
    </PageShell>
  );
}
