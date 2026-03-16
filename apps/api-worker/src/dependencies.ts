import type { SourceKind, UserCandidates, UserStatus } from '@contexted/shared';
import type {
  DropRecord,
  IngestJobRecord,
  InviteCodeRecord,
  MatchRecord,
  MessageRecord,
  PreferencesRecord,
  PriorityCreditRecord,
  ProfileIngestionRecord,
  ProfileRecord,
  ReferralRecord,
  RevealTokenRecord,
  SharedVibeCheckRecord,
  UserRecord
} from './model.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type MagicLinkResult = {
  devVerifyUrl?: string;
};

export type AuthService = {
  sendMagicLink(input: { email: string; redirectTo: string; userId?: string }): Promise<MagicLinkResult>;
  authenticateToken(token: string): Promise<AuthenticatedUser | null>;
};

export type StorageSignedUpload = {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
  storageBucket: string;
  storageKey: string;
};

export type StorageService = {
  createSignedUpload(input: {
    userId: string;
    source: SourceKind;
    fileName: string;
    expiresInSeconds: number;
    maxBytes: number;
  }): Promise<StorageSignedUpload>;
  readArtifact(path: string): Promise<unknown>;
};

export type QueueService = {
  enqueue(topic: 'ingest' | 'drop', payload: Record<string, string>): Promise<void>;
};

export type LlmService = {
  redactAndSummarize(input: { sourceText: string; source: SourceKind }): Promise<{ summary: string; piiRiskScore: number }>;
  generateVibeCheck(input: { summary: string; source: SourceKind }): Promise<string>;
  generatePairContent(input: { profileA: string; profileB: string }): Promise<{ synergyPoints: [string, string]; confessionPrompt: string }>;
};

export type EmbeddingService = {
  embed(input: string): Promise<number[]>;
};

export type Repository = {
  upsertUser(user: UserRecord): Promise<UserRecord>;
  getUserById(userId: string): Promise<UserRecord | null>;
  findOrCreateUserByEmail(email: string): Promise<UserRecord>;
  ensureUserWithAuthId(authId: string, email: string): Promise<UserRecord>;
  setUserStatus(userId: string, status: UserStatus): Promise<void>;
  hasAnyMatchForUser(userId: string): Promise<boolean>;

  upsertProfile(profile: ProfileRecord): Promise<void>;
  getProfileByUserId(userId: string): Promise<ProfileRecord | null>;
  getProfilesByUserIds(userIds: string[]): Promise<ProfileRecord[]>;
  buildCandidateMap(input: { topK: number }): Promise<UserCandidates[]>;

  createProfileIngestion(ingestion: ProfileIngestionRecord): Promise<void>;
  getProfileIngestionById(ingestionId: string): Promise<ProfileIngestionRecord | null>;
  getLatestProfileIngestionByUserId(userId: string): Promise<ProfileIngestionRecord | null>;
  updateProfileIngestion(ingestionId: string, update: Partial<ProfileIngestionRecord>): Promise<ProfileIngestionRecord | null>;

  createIngestJob(job: IngestJobRecord): Promise<void>;
  getIngestJobById(jobId: string): Promise<IngestJobRecord | null>;
  updateIngestJob(jobId: string, update: Partial<IngestJobRecord>): Promise<IngestJobRecord | null>;

  upsertDrop(drop: DropRecord): Promise<void>;
  getRelevantDrop(nowIso: string): Promise<DropRecord | null>;

  upsertPreferences(preferences: PreferencesRecord): Promise<void>;
  getPreferencesByUserId(userId: string): Promise<PreferencesRecord | null>;

  upsertMatch(match: MatchRecord): Promise<void>;
  getMatchById(matchId: string): Promise<MatchRecord | null>;
  getCurrentMatchByUserId(userId: string): Promise<MatchRecord | null>;
  updateMatch(matchId: string, update: Partial<MatchRecord>): Promise<MatchRecord | null>;

  listMessages(matchId: string, cursor?: string, limit?: number): Promise<MessageRecord[]>;
  getMessageByClientId(matchId: string, senderId: string, clientMessageId: string): Promise<MessageRecord | null>;
  createMessage(message: MessageRecord): Promise<void>;

  upsertRevealToken(token: RevealTokenRecord): Promise<void>;
  getRevealTokenByHash(tokenHash: string): Promise<RevealTokenRecord | null>;
  updateRevealToken(tokenHash: string, update: Partial<RevealTokenRecord>): Promise<RevealTokenRecord | null>;

  createReport(input: { matchId: string; reporterId: string; reportedId: string; reason: string; createdAt: string }): Promise<void>;
  countReportsByUserSince(input: { reporterId: string; sinceIso: string }): Promise<number>;

  upsertMatchFeedback(input: { matchId: string; userId: string; rating: number; createdAt: string }): Promise<void>;

  upsertSharedVibeCheck(input: SharedVibeCheckRecord): Promise<void>;
  markShareClicked(shareToken: string): Promise<boolean>;

  createInviteCode(inviteCode: InviteCodeRecord): Promise<InviteCodeRecord>;
  getInviteCodeByUserId(userId: string): Promise<InviteCodeRecord | null>;
  getInviteCodeByCode(code: string): Promise<InviteCodeRecord | null>;

  createReferral(referral: ReferralRecord): Promise<ReferralRecord>;
  getReferralByInviteeUserId(userId: string): Promise<ReferralRecord | null>;
  updateReferral(referralId: string, update: Partial<ReferralRecord>): Promise<ReferralRecord | null>;
  countQualifiedReferralsByInviterUserId(userId: string): Promise<number>;

  createPriorityCredit(credit: PriorityCreditRecord): Promise<void>;
  countAvailablePriorityCredits(userId: string): Promise<number>;
  consumePriorityCreditsForDrop(dropId: string, consumedAt: string): Promise<string[]>;

  getIdempotency(scope: string, userId: string, key: string): Promise<{ statusCode: number; responseBody: unknown } | null>;
  saveIdempotency(input: {
    scope: string;
    userId: string;
    key: string;
    statusCode: number;
    responseBody: unknown;
    createdAt: string;
  }): Promise<void>;
};

export type AppConfig = {
  maxUploadMb: number;
  signedUploadTtlSec: number;
  rawHardTtlMinutes: number;
  rawPolicyVersion: string;
  rawModeDefault: string;
  chatPollForegroundSec: number;
  chatPollBackgroundSec: number;
  processingPollMs: number;
  maxJsonBodyBytes: number;
  matchTopK: number;
  internalAdminToken?: string;
  embeddingModel: string;
  appPublicOrigin?: string;
};

export type AppDependencies = {
  config: AppConfig;
  repository: Repository;
  authService: AuthService;
  storageService: StorageService;
  queueService: QueueService;
  llmService: LlmService;
  embeddingService: EmbeddingService;
  clock: () => Date;
};
