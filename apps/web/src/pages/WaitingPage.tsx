import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAppContext } from '../AppContext.js';
import { apiRequest } from '../api.js';
import { PageShell } from '../components/PageShell.js';
import { ProfileSnapshotCard } from '../components/ProfileSnapshotCard.js';
import { ReferralInviteCard } from '../components/ReferralInviteCard.js';
import { useReducedMotion } from '../hooks/useDelight.js';
import { loadLastIntakePreview } from '../intakeDraft.js';
import { buildMemoryReview } from '../memoryReview.js';
import { usePolling } from '../polling.js';
import { buildReferralShareContent, consumeReferralFlash, fetchReferralOverview } from '../referrals.js';
import { copyToClipboard, shareOrCopy } from '../share.js';
import type { BootstrapResponse, ProfileSnapshotResponse, ReferralOverviewResponse } from '../types.js';
import { getWaitingRoomContent } from '../waitingRoom.js';

const STATUS_TONE_CLASS = {
  neutral: 'bg-bg-elevated text-text-primary',
  accent: 'bg-accent-soft text-accent-ink',
  positive: 'bg-positive-soft text-positive-ink',
  negative: 'bg-negative-soft text-negative'
} as const;

export function WaitingPage(): ReactElement {
  const navigate = useNavigate();
  const { appState, setAppState } = useAppContext();
  const reduced = useReducedMotion();
  const fallbackPreview = useMemo(() => loadLastIntakePreview(), []);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralOverviewResponse | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [referralFlash, setReferralFlash] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<ProfileSnapshotResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const waitingContent = getWaitingRoomContent(appState?.drop ?? null);

  const fadeUp = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 20 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { type: 'spring' as const, stiffness: 200, damping: 20, delay }
        };

  const syncBootstrap = useCallback(async (): Promise<void> => {
    const bootstrap = await apiRequest<BootstrapResponse>('/v1/bootstrap');

    setAppState({
      serverNow: bootstrap.server_now,
      match: bootstrap.match,
      drop: bootstrap.drop
    });
    setLoadError(null);

    if (bootstrap.phase === 'matched_locked') {
      navigate({ to: '/app/reveal' });
      return;
    }

    if (bootstrap.phase === 'chat_unlocked') {
      navigate({ to: '/app/chat' });
      return;
    }

    if (bootstrap.phase === 'expired') {
      navigate({ to: '/app/expired' });
      return;
    }

    if (bootstrap.phase !== 'waiting') {
      navigate({ to: '/app' });
    }
  }, [navigate, setAppState]);

  async function loadReferralOverview(): Promise<void> {
    try {
      setLoadingReferral(true);
      const nextReferral = await fetchReferralOverview();
      setReferral(nextReferral);
      setReferralError(null);
    } catch (error) {
      setReferral(null);
      setReferralError('Private invites are warming up. Your place in line stays intact.');
    } finally {
      setLoadingReferral(false);
    }
  }

  async function loadProfilePreview(): Promise<void> {
    try {
      const nextProfile = await apiRequest<ProfileSnapshotResponse>('/v1/profile/me');
      setProfilePreview(nextProfile);
      setProfileError(null);
    } catch (error) {
      setProfilePreview(null);
      setProfileError(
        fallbackPreview
          ? 'Showing the local preview you approved while the live profile card catches up.'
          : 'Your live profile preview is not available yet.'
      );
    }
  }

  async function handleShare(): Promise<void> {
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
  }

  async function handleCopy(): Promise<void> {
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
  }

  useEffect(() => {
    setReferralFlash(consumeReferralFlash());
    void syncBootstrap().catch((reason) => {
      setLoadError(reason instanceof Error ? reason.message : 'Live drop status unavailable right now.');
    });
    void loadReferralOverview();
    void loadProfilePreview();
  }, [fallbackPreview, syncBootstrap]);

  usePolling({
    enabled: true,
    intervalMs: 15000,
    backgroundIntervalMs: 60000,
    onTick: async () => {
      try {
        await syncBootstrap();
      } catch (reason) {
        setLoadError(reason instanceof Error ? reason.message : 'Live drop status unavailable right now.');
      }
    }
  });

  const liveSignals = useMemo(
    () => (profilePreview ? buildMemoryReview(profilePreview.sanitized_summary).signals : []),
    [profilePreview]
  );
  const liveProviderLabel = profilePreview
    ? profilePreview.source === 'chatgpt'
      ? 'ChatGPT excerpt'
      : profilePreview.source === 'claude'
        ? 'Claude excerpt'
        : 'Mixed provider excerpt'
    : null;

  return (
    <PageShell blobs="waiting">
      <div className="px-6 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1.02fr)_minmax(18rem,0.88fr)] md:items-start md:gap-6 lg:gap-8">
          <div className="flex flex-col gap-6">
            <motion.div
              className="flex flex-col items-center gap-4 text-center md:items-start md:text-left"
              {...fadeUp(0)}
            >
              <h1 className="font-heading text-[32px] font-bold text-text-primary md:max-w-2xl md:text-[36px] lg:text-[40px]">
                {waitingContent.title}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-text-secondary">{waitingContent.body}</p>
              <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {waitingContent.pills.map((pill) => (
                  <div
                    key={pill}
                    className="rounded-full border border-border-default bg-bg-card px-4 py-2 text-sm text-text-secondary"
                  >
                    {pill}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.section
              className="rounded-[28px] border border-border-default bg-bg-card p-5 lg:p-6"
              {...fadeUp(0.1)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">CURRENT DROP</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE_CLASS[waitingContent.tone]}`}
                >
                  {waitingContent.statusLabel}
                </span>
              </div>
              <p className="mt-4 font-heading text-base font-semibold text-text-primary">{waitingContent.statusTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{waitingContent.statusBody}</p>
              <ul className="mt-4 space-y-3">
                {waitingContent.facts.map((fact) => (
                  <li key={fact} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-positive" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
              {loadError ? (
                <p className="mt-3 text-sm text-text-muted" role="status">
                  Live refresh hit a snag. We&rsquo;re showing the last honest state we have.
                </p>
              ) : null}
            </motion.section>

            {profilePreview && liveProviderLabel ? (
              <motion.div {...fadeUp(0.18)}>
                <ProfileSnapshotCard
                  eyebrow="WHAT YOUR PROFILE HOLDS"
                  title="The derived profile that will travel into the next drop."
                  providerLabel={liveProviderLabel}
                  summary={profilePreview.sanitized_summary}
                  vibeCheck={profilePreview.vibe_check_card}
                  signals={liveSignals}
                  footer="This is the actual derived output from your reviewed excerpt, not a placeholder."
                />
              </motion.div>
            ) : fallbackPreview ? (
              <motion.div {...fadeUp(0.18)}>
                <ProfileSnapshotCard
                  eyebrow="YOUR APPROVED PREVIEW"
                  title="The reviewed excerpt you approved is still visible while the live card catches up."
                  providerLabel={fallbackPreview.providerLabel}
                  summary={fallbackPreview.redactedPreviewText}
                  signals={fallbackPreview.signals}
                  alerts={fallbackPreview.alerts}
                  tone="preview"
                  footer={profileError ?? 'This is the local preview you approved before processing finished.'}
                />
              </motion.div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 md:sticky md:top-8">
            <motion.div {...fadeUp(0.16)}>
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

            <motion.section
              className="flex flex-col gap-3 rounded-[28px] border border-border-default bg-bg-card p-5 lg:p-6"
              {...fadeUp(0.24)}
            >
              <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">HOW MEMORY GETS READ</span>
              <p className="text-sm leading-relaxed text-text-primary">
                Contexted looks for tone, recurring themes, and the way your reviewed excerpt keeps describing you —
                then tests that against what someone else keeps returning to.
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                The goal is less “best profile” and more “similar soul, similar chapter.”
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                This is an alpha. Automatic redaction is intentionally limited, and the matching signals, reveal
                language, and memory read keep changing as we learn what social value AI memory can actually create.
              </p>
            </motion.section>

            <motion.section
              className="rounded-[28px] border border-chatgpt bg-bg-card p-5 lg:p-6"
              {...fadeUp(0.32)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex max-w-md flex-col gap-1">
                  <p className="text-sm font-semibold text-text-primary">Memory-to-memory</p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    A future mode for comparing two memories outside the main drop — a quieter way to test “same
                    chapter” without turning this into swipes.
                  </p>
                </div>
                <span className="rounded-full bg-positive-soft px-3 py-1 text-xs font-semibold text-positive-ink">
                  Coming soon
                </span>
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
