import type { AppPhase, DropStatus } from '@contexted/shared';

export type BootstrapDrop = {
  id: string;
  status: DropStatus;
  scheduled_at: string;
  mode: string;
  pool_size: number | null;
  failure_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type BootstrapResponse = {
  phase: AppPhase;
  has_preferences: boolean;
  intake: null | { state: string; ingestion_id: string };
  server_now: string;
  match: null | {
    match_id: string;
    state: string;
    deadline_at: string | null;
    chat_expires_at: string | null;
    version: number;
  };
  drop: BootstrapDrop | null;
};

export type MatchResponse = {
  match_id: string | null;
  state: string;
  synergy_points: string[];
  confession_prompt: string | null;
  my_confession: string | null;
  partner_confession: string | null;
  deadline_at: string | null;
  chat_expires_at: string | null;
  version: number;
  poll_after_ms: number;
};

export type MessageList = {
  items: Array<{ id: string; senderId: string; body: string; createdAt: string }>;
  next_cursor: string | null;
  poll_after_ms: number;
  chat_expires_at: string;
};

export type ReferralOverviewResponse = {
  invite_url: string | null;
  invite_code: string | null;
  landed_referrals: number;
  max_landed_referrals: number;
  available_priority_credits: number;
  remaining_referral_rewards: number;
  can_invite: boolean;
};

export type ReferralClaimResponse = {
  claimed: boolean;
  eligible_for_reward: boolean;
  reason?: string;
};

export type ReferralShareContent = {
  title: string;
  text: string;
  url: string;
};
