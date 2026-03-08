import type {
  DropStatus,
  GenderIdentity,
  MatchStatus,
  SourceKind,
  UserStatus
} from '@contexted/shared';

export type UserRecord = {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  queueEnteredAt?: string;
  lastActiveAt?: string;
  deletedAt?: string;
};

export type PreferencesRecord = {
  userId: string;
  genderIdentity: GenderIdentity;
  attractedTo: GenderIdentity[];
  ageMin: number;
  ageMax: number;
};

export type ProfileRecord = {
  userId: string;
  source: SourceKind;
  matchText: string;
  sanitizedSummary: string;
  vibeCheckCard?: string;
  embedding: number[];
  embeddingModel: string;
  piiRiskScore: number;
  retentionExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type IngestionStatus = 'initiated' | 'queued' | 'processing' | 'completed' | 'failed' | 'expired';

export type ProfileIngestionRecord = {
  id: string;
  userId: string;
  source: SourceKind;
  storageBucket: string;
  storageKey: string;
  sha256: string;
  sizeBytes: number;
  status: IngestionStatus;
  errorCode?: string;
  piiRiskScore: number;
  rawMode: string;
  rawDeleteDueAt: string;
  rawDeletedAt?: string;
  rawDeleteAttempts: number;
  rawDeleteLastError?: string;
  policyVersion: string;
  uploadExpiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

export type IngestJobRecord = {
  id: string;
  ingestionId: string;
  userId: string;
  state: JobStatus;
  progress: number;
  errorCode?: string;
  retryable: boolean;
  pollAfterMs: number;
  createdAt: string;
  updatedAt: string;
};

export type DropRecord = {
  id: string;
  scheduledAt: string;
  status: DropStatus;
  mode: string;
  poolSize?: number;
  failureReason?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
};

export type MatchRecord = {
  id: string;
  dropId: string;
  userAId: string;
  userBId: string;
  status: MatchStatus;
  synergyPoints: string[];
  confessionPrompt: string;
  userAConfession?: string;
  userBConfession?: string;
  responseDeadline: string;
  unlockedAt?: string;
  expiresAt: string;
  version: number;
  createdAt: string;
};

export type MessageRecord = {
  id: string;
  matchId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  deletedAt?: string;
};

export type RevealTokenRecord = {
  tokenHash: string;
  matchId: string;
  userId: string;
  artifactPath: string;
  expiresAt: string;
  usedAt?: string;
};

export type ReportRecord = {
  id: string;
  matchId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  createdAt: string;
};

export type MatchFeedbackRecord = {
  matchId: string;
  userId: string;
  rating: number;
  createdAt: string;
};

export type SharedVibeCheckRecord = {
  id: string;
  userId: string;
  shareToken: string;
  platform?: string;
  clicked: boolean;
  createdAt: string;
};

export type InviteCodeRecord = {
  userId: string;
  code: string;
  createdAt: string;
  disabledAt?: string;
};

export type ReferralStatus = 'clicked' | 'claimed' | 'qualified' | 'rewarded' | 'ineligible';

export type ReferralRecord = {
  id: string;
  inviterUserId: string;
  inviteeUserId?: string;
  inviteCode: string;
  status: ReferralStatus;
  ineligibleReason?: string;
  claimedAt?: string;
  qualifiedAt?: string;
  rewardedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PriorityCreditStatus = 'available' | 'consumed' | 'expired';
export type PriorityCreditSourceType = 'referral_inviter' | 'referral_invitee';

export type PriorityCreditRecord = {
  id: string;
  userId: string;
  sourceType: PriorityCreditSourceType;
  referralId: string;
  status: PriorityCreditStatus;
  availableAt: string;
  consumedAt?: string;
  consumedInDropId?: string;
  expiresAt?: string;
  createdAt: string;
};

export type IdempotencyRecord = {
  idempotencyKey: string;
  scope: string;
  userId: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: string;
};
