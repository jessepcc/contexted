export const USER_STATUS = [
  'waiting',
  'processing',
  'ready',
  'matched',
  're_queued',
  'blocked',
  'quarantined',
  'failed'
] as const;

export const DROP_STATUS = [
  'scheduled',
  'ingest_closed',
  'matching',
  'content_ready',
  'published',
  'notified',
  'closed',
  'paused',
  'failed'
] as const;

export const MATCH_STATUS = ['pending_confession', 'unlocked', 'expired', 'closed'] as const;

export const SOURCE_KIND = ['chatgpt', 'claude', 'both'] as const;

export const GENDER_IDENTITY = ['M', 'F', 'NB'] as const;

export type UserStatus = (typeof USER_STATUS)[number];
export type DropStatus = (typeof DROP_STATUS)[number];
export type MatchStatus = (typeof MATCH_STATUS)[number];
export type SourceKind = (typeof SOURCE_KIND)[number];
export type GenderIdentity = (typeof GENDER_IDENTITY)[number];

export type AppPhase =
  | 'upload'
  | 'processing'
  | 'waiting'
  | 'matched_locked'
  | 'chat_unlocked'
  | 'expired';
