import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api.js';
import { AppContext } from '../AppContext.js';
import { PageShell } from '../components/PageShell.js';
import { clearActiveJobId, loadIntakeDraft, getActiveJobId } from '../intakeDraft.js';
import { claimPendingInvite, setReferralFlash } from '../referrals.js';
import type { BootstrapResponse } from '../types.js';

export function AppGatewayPage(): ReactElement {
  const navigate = useNavigate();
  const appCtx = useContext(AppContext);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function routeByPhase(): Promise<void> {
      try {
        const bootstrap = await apiRequest<BootstrapResponse>('/v1/bootstrap');
        if (!mounted) {
          return;
        }

        appCtx?.setAppState({
          serverNow: bootstrap.server_now,
          match: bootstrap.match,
          drop: bootstrap.drop
        });

        try {
          await claimPendingInvite();
        } catch (claimError) {
          console.warn('Referral claim failed', claimError);
          setReferralFlash('We couldn’t confirm that private invite yet. We’ll keep trying quietly from here.');
        }

        const intakeDraft = loadIntakeDraft();

        if (bootstrap.phase === 'processing') {
          navigate({
            to: '/app/processing',
            search: { jobId: getActiveJobId() ?? '' }
          });
          return;
        }

        const target =
          bootstrap.phase === 'upload'
            ? intakeDraft
              ? '/app/preferences'
              : '/'
            : bootstrap.phase === 'waiting'
              ? !bootstrap.has_preferences
                ? intakeDraft
                  ? '/app/preferences'
                  : '/'
                : intakeDraft !== null && bootstrap.intake === null
                  ? '/app/preferences'
                  : '/app/waiting'
              : bootstrap.phase === 'matched_locked'
                ? '/app/reveal'
                : bootstrap.phase === 'chat_unlocked'
                  ? '/app/chat'
                  : '/app/expired';

        clearActiveJobId();
        navigate({ to: target });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to load bootstrap state.');
        navigate({ to: '/app/error' });
      }
    }

    void routeByPhase();
    return () => {
      mounted = false;
    };
  }, [navigate, appCtx]);

  return (
    <PageShell blobs="landing">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Checking your place in the alpha</h1>
        {error ? (
          <p className="text-sm leading-relaxed text-text-secondary">{error}</p>
        ) : (
          <>
            <p className="max-w-md text-sm leading-relaxed text-text-secondary">
              We&rsquo;re checking whether your memory is still processing, waiting for the next drop, or ready to open.
            </p>
            <p className="max-w-md text-xs font-medium tracking-[0.02em] text-text-secondary/90" role="status" aria-live="polite">
              If a private invite came with you, we&rsquo;re attaching it before we place you.
            </p>
            <div
              className="h-8 w-8 rounded-full border-4 border-accent border-t-transparent animate-spin"
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
