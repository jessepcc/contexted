import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMagicLinkRedirect,
  buildReferralShareContent,
  claimPendingInvite,
  clearPendingInviteCode,
  consumeReferralFlash,
  getInviteCodeFromSearch,
  normalizeReferralOverview,
  savePendingInviteCode,
  trackInviteClick
} from '../src/referrals.js';

describe('referrals helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a safe invite code from search params', () => {
    expect(getInviteCodeFromSearch('?invite=Alpha_123')).toBe('Alpha_123');
    expect(getInviteCodeFromSearch('?invite=bad code')).toBeNull();
    expect(getInviteCodeFromSearch('')).toBeNull();
  });

  it('builds a magic link redirect with the pending invite code', () => {
    savePendingInviteCode('quiet-link');
    expect(buildMagicLinkRedirect('https://contexted.app')).toBe('https://contexted.app/auth/verify?invite=quiet-link');
  });

  it('normalizes incomplete referral overview payloads', () => {
    expect(normalizeReferralOverview({ invite_code: 'abc123' })).toEqual({
      invite_url: null,
      invite_code: 'abc123',
      landed_referrals: 0,
      max_landed_referrals: 2,
      available_priority_credits: 0,
      remaining_referral_rewards: 0,
      can_invite: false
    });
  });

  it('builds share content only when the invite payload is complete', () => {
    expect(
      buildReferralShareContent({
        invite_url: 'https://contexted.app/?invite=abc123',
        invite_code: 'abc123',
        landed_referrals: 1,
        max_landed_referrals: 2,
        available_priority_credits: 1,
        remaining_referral_rewards: 1,
        can_invite: true
      })
    ).toEqual({
      title: 'Contexted',
      text: 'I’m trying Contexted — a small alpha that starts from the memory AI keeps about us instead of swipes. If you want in, here’s my private link.',
      url: 'https://contexted.app/?invite=abc123'
    });

    expect(
      buildReferralShareContent({
        invite_url: null,
        invite_code: 'abc123',
        landed_referrals: 0,
        max_landed_referrals: 2,
        available_priority_credits: 0,
        remaining_referral_rewards: 2,
        can_invite: false
      })
    ).toBeNull();
  });

  it('claims a pending invite, clears storage, and stores a flash message', async () => {
    savePendingInviteCode('quiet-link');
    localStorage.setItem('contexted_token', 'token-123');

    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ claimed: true, eligible_for_reward: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(claimPendingInvite()).resolves.toBe('claimed');
    expect(localStorage.getItem('contexted_pending_invite_code')).toBeNull();
    expect(consumeReferralFlash()).toContain('Finish your memory read');
  });

  it.each([404, 422])(
    'stores a calm flash for non-retriable claim failure %s and clears the pending invite',
    async (status) => {
      savePendingInviteCode('quiet-link');
      localStorage.setItem('contexted_token', 'token-123');

      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ code: 'STATE_CONFLICT', message: 'Invite already handled.' }), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      await expect(claimPendingInvite()).resolves.toBe('ignored');
      expect(localStorage.getItem('contexted_pending_invite_code')).toBeNull();
      expect(consumeReferralFlash()).toContain('couldn’t be attached');
    }
  );

  it('leaves retriable claim failures alone so the app can try again later', async () => {
    savePendingInviteCode('quiet-link');
    localStorage.setItem('contexted_token', 'token-123');

    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'STATE_CONFLICT', message: 'Temporary outage.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(claimPendingInvite()).rejects.toThrow();
    expect(localStorage.getItem('contexted_pending_invite_code')).toBe('quiet-link');
  });

  it('swallows invite click tracking failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));

    await expect(trackInviteClick('quiet-link')).resolves.toBeUndefined();
  });

  it('clears the pending invite helper explicitly', () => {
    savePendingInviteCode('quiet-link');
    clearPendingInviteCode();
    expect(localStorage.getItem('contexted_pending_invite_code')).toBeNull();
  });
});
