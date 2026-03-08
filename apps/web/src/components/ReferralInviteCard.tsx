import type { ReactElement } from 'react';
import { Button } from './Button.js';
import type { ReferralOverviewResponse } from '../types.js';

function pluralize(count: number, singular: string, plural = singular + 's'): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type ReferralInviteCardProps = {
  referral: ReferralOverviewResponse | null;
  shareStatus: string | null;
  loading: boolean;
  error: string | null;
  flashMessage?: string | null;
  onShare: () => Promise<void> | void;
  onCopy: () => Promise<void> | void;
};

export function ReferralInviteCard({
  referral,
  shareStatus,
  loading,
  error,
  flashMessage,
  onShare,
  onCopy
}: ReferralInviteCardProps): ReactElement {
  const landedReferrals = referral?.landed_referrals ?? 0;
  const maxLandedReferrals = referral?.max_landed_referrals ?? 2;
  const availablePriorityCredits = referral?.available_priority_credits ?? 0;
  const canInvite = Boolean(referral?.can_invite && referral.invite_url);

  return (
    <section className="flex w-full flex-col gap-4 rounded-[28px] border border-border-default bg-bg-card p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-xl flex-col gap-2">
          <span className="text-[12px] font-bold tracking-[0.18em] text-text-muted">PRIVATE INVITE</span>
          <p className="font-heading text-lg font-semibold text-text-primary">Bring one thoughtful person</p>
          <p className="text-sm leading-relaxed text-text-secondary">
            If they finish their memory read, you both get earlier consideration in the next drop.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-ink">
            {landedReferrals} / {maxLandedReferrals} invites landed
          </span>
          <span className="rounded-full bg-positive-soft px-3 py-1 text-positive-ink">
            {pluralize(availablePriorityCredits, 'priority credit')} waiting
          </span>
        </div>
      </div>

      {referral?.invite_code ? (
        <div className="rounded-[22px] border border-border-default bg-bg-elevated/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold tracking-[0.18em] text-text-muted">PRIVATE CODE</span>
            <span className="min-w-0 break-all font-heading text-sm font-semibold tracking-[0.18em] text-text-primary">
              {referral.invite_code}
            </span>
          </div>
        </div>
      ) : null}

      {flashMessage ? (
        <div className="rounded-[22px] border border-positive/20 bg-positive-soft px-4 py-3 text-sm text-positive-ink">
          {flashMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="secondary" className="w-full" onClick={() => void onCopy()} disabled={!canInvite || loading}>
          Copy private invite
        </Button>
        <Button type="button" className="w-full" onClick={() => void onShare()} disabled={!canInvite || loading}>
          Share privately
        </Button>
      </div>

      <div className="flex flex-col gap-2 text-sm leading-relaxed text-text-secondary">
        <p>Earlier consideration, not guaranteed matching.</p>
        {loading ? <p>Warming up your private link…</p> : null}
        {!loading && !canInvite ? <p>Private invites are warming up. Your place in line stays intact.</p> : null}
        {shareStatus ? (
          <p className="text-positive-ink" role="status">
            {shareStatus}
          </p>
        ) : null}
        {error ? <p className="text-text-muted">{error}</p> : null}
      </div>
    </section>
  );
}
