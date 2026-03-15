import { apiRequest, apiRequestRaw, HttpError } from './api.js';
import type { ReferralClaimResponse, ReferralOverviewResponse, ReferralShareContent } from './types.js';

const PENDING_INVITE_KEY = 'contexted_pending_invite_code';
const REFERRAL_FLASH_KEY = 'contexted_referral_flash';

function sanitizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 120) {
    return null;
  }

  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
}

function asCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getInviteCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return sanitizeInviteCode(params.get('invite'));
}

export function loadPendingInviteCode(): string | null {
  return sanitizeInviteCode(localStorage.getItem(PENDING_INVITE_KEY));
}

export function savePendingInviteCode(inviteCode: string): void {
  const sanitized = sanitizeInviteCode(inviteCode);
  if (!sanitized) {
    return;
  }

  localStorage.setItem(PENDING_INVITE_KEY, sanitized);
}

export function clearPendingInviteCode(): void {
  localStorage.removeItem(PENDING_INVITE_KEY);
}

export function buildMagicLinkRedirect(origin: string, inviteCode = loadPendingInviteCode()): string {
  const redirect = new URL('/auth/verify', origin);
  if (inviteCode) {
    redirect.searchParams.set('invite', inviteCode);
  }
  return redirect.toString();
}

export function setReferralFlash(message: string): void {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }

  sessionStorage.setItem(REFERRAL_FLASH_KEY, trimmed);
}

export function consumeReferralFlash(): string | null {
  const raw = sessionStorage.getItem(REFERRAL_FLASH_KEY);
  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(REFERRAL_FLASH_KEY);
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeReferralOverview(
  raw: Partial<ReferralOverviewResponse> | null | undefined
): ReferralOverviewResponse {
  const inviteCode = sanitizeInviteCode(raw?.invite_code) ?? null;
  const inviteUrl =
    typeof raw?.invite_url === 'string' && raw.invite_url.trim().length > 0 ? raw.invite_url.trim() : null;

  return {
    invite_url: inviteUrl,
    invite_code: inviteCode,
    landed_referrals: asCount(raw?.landed_referrals),
    max_landed_referrals: Math.max(1, asCount(raw?.max_landed_referrals, 2)),
    available_priority_credits: asCount(raw?.available_priority_credits),
    remaining_referral_rewards: asCount(raw?.remaining_referral_rewards, 0),
    can_invite: Boolean(raw?.can_invite && inviteUrl && inviteCode)
  };
}

export async function fetchReferralOverview(): Promise<ReferralOverviewResponse> {
  const response = await apiRequest<ReferralOverviewResponse>('/v1/referrals/me');
  return normalizeReferralOverview(response);
}

export async function trackInviteClick(inviteCode: string): Promise<void> {
  const sanitized = sanitizeInviteCode(inviteCode);
  if (!sanitized) {
    return;
  }

  try {
    await apiRequestRaw(`/v1/referrals/${encodeURIComponent(sanitized)}/click`, {
      method: 'POST'
    });
  } catch {
    // Private invite tracking should never block the landing experience.
  }
}

export async function claimPendingInvite(): Promise<'none' | 'claimed' | 'ignored'> {
  const inviteCode = loadPendingInviteCode();
  if (!inviteCode) {
    return 'none';
  }

  try {
    const response = await apiRequest<ReferralClaimResponse>('/v1/referrals/claim', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode })
    });

    if (response.claimed) {
      setReferralFlash(
        response.eligible_for_reward
          ? 'Private invite attached. Finish your memory read and we’ll move you both up in the next drop.'
          : 'Private invite attached. We’ll keep it quietly connected from here.'
      );
    }

    clearPendingInviteCode();
    return response.claimed ? 'claimed' : 'ignored';
  } catch (error) {
    if (error instanceof HttpError && [400, 404, 409, 422].includes(error.status)) {
      setReferralFlash('That private invite couldn’t be attached, but your place in line stays intact.');
      clearPendingInviteCode();
      return 'ignored';
    }

    throw error;
  }
}

export function buildReferralShareContent(referral: ReferralOverviewResponse): ReferralShareContent | null {
  if (!referral.invite_url || !referral.invite_code) {
    return null;
  }

  return {
    title: 'Contexted',
    text: 'I’m trying Contexted — a small alpha that starts from the memory AI keeps about us instead of swipes. If you want in, here’s my private link.',
    url: referral.invite_url
  };
}
