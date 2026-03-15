import type { UserCandidates } from '@contexted/shared';
import type {
  DropRecord,
  IngestJobRecord,
  InviteCodeRecord,
  MatchFeedbackRecord,
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
import type { Repository } from './dependencies.js';

function sortByCreatedAt<T extends { createdAt: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sortByScheduledAt<T extends { scheduledAt: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
}

function cosineSimilarity(left: number[], right: number[]): number {
  const dimensions = Math.min(left.length, right.length);
  if (dimensions === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < dimensions; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function areMutuallyCompatible(source: PreferencesRecord, candidate: PreferencesRecord): boolean {
  return (
    source.attractedTo.includes(candidate.genderIdentity) &&
    candidate.attractedTo.includes(source.genderIdentity)
  );
}

function haveMatchedBefore(matches: Iterable<MatchRecord>, userAId: string, userBId: string): boolean {
  for (const match of matches) {
    if (
      (match.userAId === userAId && match.userBId === userBId) ||
      (match.userAId === userBId && match.userBId === userAId)
    ) {
      return true;
    }
  }

  return false;
}

export class InMemoryRepository implements Repository {
  public readonly users = new Map<string, UserRecord>();
  public readonly profiles = new Map<string, ProfileRecord>();
  public readonly ingestions = new Map<string, ProfileIngestionRecord>();
  public readonly ingestJobs = new Map<string, IngestJobRecord>();
  public readonly drops = new Map<string, DropRecord>();
  public readonly preferences = new Map<string, PreferencesRecord>();
  public readonly matches = new Map<string, MatchRecord>();
  public readonly messages = new Map<string, MessageRecord>();
  public readonly revealTokens = new Map<string, RevealTokenRecord>();
  public readonly reports: Array<{
    matchId: string;
    reporterId: string;
    reportedId: string;
    reason: string;
    createdAt: string;
  }> = [];
  public readonly matchFeedback = new Map<string, MatchFeedbackRecord>();
  public readonly sharedVibeChecks = new Map<string, SharedVibeCheckRecord>();
  public readonly inviteCodes = new Map<string, InviteCodeRecord>();
  public readonly inviteCodesByCode = new Map<string, InviteCodeRecord>();
  public readonly referrals = new Map<string, ReferralRecord>();
  public readonly priorityCredits = new Map<string, PriorityCreditRecord>();
  public readonly idempotency = new Map<string, { statusCode: number; responseBody: unknown }>();

  async upsertUser(user: UserRecord): Promise<UserRecord> {
    this.users.set(user.id, user);
    return user;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async findOrCreateUserByEmail(email: string): Promise<UserRecord> {
    const existing = [...this.users.values()].find((item) => item.email === email);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const created: UserRecord = {
      id: crypto.randomUUID(),
      email,
      status: 'waiting',
      createdAt: now,
      lastActiveAt: now
    };

    this.users.set(created.id, created);
    return created;
  }

  async ensureUserWithAuthId(authId: string, email: string): Promise<UserRecord> {
    const byId = this.users.get(authId);
    if (byId) {
      return byId;
    }

    const byEmail = [...this.users.values()].find((item) => item.email === email);
    if (byEmail) {
      this.users.delete(byEmail.id);
      byEmail.id = authId;
      this.users.set(authId, byEmail);
      return byEmail;
    }

    const now = new Date().toISOString();
    const created: UserRecord = { id: authId, email, status: 'waiting', createdAt: now, lastActiveAt: now };
    this.users.set(authId, created);
    return created;
  }

  async setUserStatus(userId: string, status: UserRecord['status']): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }

    this.users.set(userId, {
      ...user,
      status,
      lastActiveAt: new Date().toISOString()
    });
  }

  async hasAnyMatchForUser(userId: string): Promise<boolean> {
    return [...this.matches.values()].some((match) => match.userAId === userId || match.userBId === userId);
  }

  async upsertProfile(profile: ProfileRecord): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }

  async getProfileByUserId(userId: string): Promise<ProfileRecord | null> {
    return this.profiles.get(userId) ?? null;
  }

  async getProfilesByUserIds(userIds: string[]): Promise<ProfileRecord[]> {
    return userIds.flatMap((userId) => {
      const profile = this.profiles.get(userId);
      return profile ? [profile] : [];
    });
  }

  async buildCandidateMap(input: { topK: number }): Promise<UserCandidates[]> {
    const topK = Math.max(1, input.topK);
    const waitingUsers = [...this.users.values()].filter((user) => user.status === 'waiting' && !user.deletedAt);
    const matches = [...this.matches.values()];
    const availableCreditsByUser = new Map<string, number>();

    for (const credit of this.priorityCredits.values()) {
      if (credit.status !== 'available') {
        continue;
      }

      availableCreditsByUser.set(credit.userId, (availableCreditsByUser.get(credit.userId) ?? 0) + 1);
    }

    return waitingUsers.flatMap((user) => {
      const sourceProfile = this.profiles.get(user.id);
      const sourcePreferences = this.preferences.get(user.id);
      if (!sourceProfile || !sourcePreferences || sourceProfile.matchText.trim().length === 0) {
        return [];
      }

      const candidates = waitingUsers
        .filter((candidate) => candidate.id !== user.id)
        .flatMap((candidate) => {
          const candidateProfile = this.profiles.get(candidate.id);
          const candidatePreferences = this.preferences.get(candidate.id);
          if (!candidateProfile || !candidatePreferences || candidateProfile.matchText.trim().length === 0) {
            return [];
          }

          if (candidateProfile.embeddingModel !== sourceProfile.embeddingModel) {
            return [];
          }

          if (!areMutuallyCompatible(sourcePreferences, candidatePreferences)) {
            return [];
          }

          if (haveMatchedBefore(matches, user.id, candidate.id)) {
            return [];
          }

          return [
            {
              targetUserId: candidate.id,
              score: cosineSimilarity(sourceProfile.embedding, candidateProfile.embedding)
            }
          ];
        })
        .sort((left, right) => right.score - left.score || left.targetUserId.localeCompare(right.targetUserId))
        .slice(0, topK);

      return [
        {
          userId: user.id,
          priorityTier: (availableCreditsByUser.get(user.id) ?? 0) > 0 ? 1 : 0,
          queueEnteredAt: user.queueEnteredAt,
          candidates
        }
      ];
    });
  }

  async createProfileIngestion(ingestion: ProfileIngestionRecord): Promise<void> {
    this.ingestions.set(ingestion.id, ingestion);
  }

  async getProfileIngestionById(ingestionId: string): Promise<ProfileIngestionRecord | null> {
    return this.ingestions.get(ingestionId) ?? null;
  }

  async getLatestProfileIngestionByUserId(userId: string): Promise<ProfileIngestionRecord | null> {
    const userIngestions = [...this.ingestions.values()].filter((ingestion) => ingestion.userId === userId);
    if (userIngestions.length === 0) {
      return null;
    }

    return sortByCreatedAt(userIngestions).at(-1) ?? null;
  }

  async updateProfileIngestion(
    ingestionId: string,
    update: Partial<ProfileIngestionRecord>
  ): Promise<ProfileIngestionRecord | null> {
    const existing = this.ingestions.get(ingestionId);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString()
    };

    this.ingestions.set(ingestionId, updated);
    return updated;
  }

  async createIngestJob(job: IngestJobRecord): Promise<void> {
    this.ingestJobs.set(job.id, job);
  }

  async getIngestJobById(jobId: string): Promise<IngestJobRecord | null> {
    return this.ingestJobs.get(jobId) ?? null;
  }

  async updateIngestJob(jobId: string, update: Partial<IngestJobRecord>): Promise<IngestJobRecord | null> {
    const existing = this.ingestJobs.get(jobId);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString()
    };

    this.ingestJobs.set(jobId, updated);
    return updated;
  }

  async upsertDrop(drop: DropRecord): Promise<void> {
    this.drops.set(drop.id, drop);
  }

  async getRelevantDrop(nowIso: string): Promise<DropRecord | null> {
    const drops = [...this.drops.values()];
    if (drops.length === 0) {
      return null;
    }

    const activeStatuses = new Set<DropRecord['status']>([
      'ingest_closed',
      'matching',
      'content_ready',
      'published',
      'notified',
      'paused',
      'failed'
    ]);

    const active = sortByScheduledAt(drops.filter((drop) => activeStatuses.has(drop.status))).at(-1) ?? null;
    if (active) {
      return active;
    }

    const upcoming =
      sortByScheduledAt(
        drops.filter((drop) => drop.status === 'scheduled' && drop.scheduledAt.localeCompare(nowIso) >= 0)
      )[0] ?? null;
    if (upcoming) {
      return upcoming;
    }

    const lastScheduled = sortByScheduledAt(drops.filter((drop) => drop.status === 'scheduled')).at(-1) ?? null;
    if (lastScheduled) {
      return lastScheduled;
    }

    const open = sortByScheduledAt(drops.filter((drop) => drop.status !== 'closed')).at(-1) ?? null;
    if (open) {
      return open;
    }

    return sortByCreatedAt(drops).at(-1) ?? null;
  }

  async upsertPreferences(preferences: PreferencesRecord): Promise<void> {
    this.preferences.set(preferences.userId, preferences);
  }

  async getPreferencesByUserId(userId: string): Promise<PreferencesRecord | null> {
    return this.preferences.get(userId) ?? null;
  }

  async upsertMatch(match: MatchRecord): Promise<void> {
    this.matches.set(match.id, match);
  }

  async getMatchById(matchId: string): Promise<MatchRecord | null> {
    return this.matches.get(matchId) ?? null;
  }

  async getCurrentMatchByUserId(userId: string): Promise<MatchRecord | null> {
    const userMatches = [...this.matches.values()].filter(
      (match) => match.userAId === userId || match.userBId === userId
    );

    if (userMatches.length === 0) {
      return null;
    }

    const active = userMatches.filter((match) => ['pending_confession', 'unlocked'].includes(match.status));
    if (active.length > 0) {
      return sortByCreatedAt(active).at(-1) ?? null;
    }

    return sortByCreatedAt(userMatches).at(-1) ?? null;
  }

  async updateMatch(matchId: string, update: Partial<MatchRecord>): Promise<MatchRecord | null> {
    const existing = this.matches.get(matchId);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...update
    };

    this.matches.set(matchId, updated);
    return updated;
  }

  async listMessages(matchId: string, cursor?: string, limit = 50): Promise<MessageRecord[]> {
    const sorted = sortByCreatedAt(
      [...this.messages.values()].filter((message) => message.matchId === matchId && message.deletedAt === undefined)
    );

    const filtered = cursor === undefined ? sorted : sorted.filter((message) => message.createdAt > cursor);
    return filtered.slice(0, limit);
  }

  async getMessageByClientId(matchId: string, senderId: string, clientMessageId: string): Promise<MessageRecord | null> {
    const message = [...this.messages.values()].find(
      (item) => item.matchId === matchId && item.senderId === senderId && item.clientMessageId === clientMessageId
    );

    return message ?? null;
  }

  async createMessage(message: MessageRecord): Promise<void> {
    this.messages.set(message.id, message);
  }

  async upsertRevealToken(token: RevealTokenRecord): Promise<void> {
    this.revealTokens.set(token.tokenHash, token);
  }

  async getRevealTokenByHash(tokenHash: string): Promise<RevealTokenRecord | null> {
    return this.revealTokens.get(tokenHash) ?? null;
  }

  async updateRevealToken(tokenHash: string, update: Partial<RevealTokenRecord>): Promise<RevealTokenRecord | null> {
    const existing = this.revealTokens.get(tokenHash);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...update
    };

    this.revealTokens.set(tokenHash, updated);
    return updated;
  }

  async createReport(input: {
    matchId: string;
    reporterId: string;
    reportedId: string;
    reason: string;
    createdAt: string;
  }): Promise<void> {
    this.reports.push(input);
  }

  async countReportsByUserSince(input: { reporterId: string; sinceIso: string }): Promise<number> {
    return this.reports.filter(
      (report) => report.reporterId === input.reporterId && report.createdAt >= input.sinceIso
    ).length;
  }

  async upsertMatchFeedback(input: { matchId: string; userId: string; rating: number; createdAt: string }): Promise<void> {
    this.matchFeedback.set(`${input.matchId}:${input.userId}`, input);
  }

  async upsertSharedVibeCheck(input: SharedVibeCheckRecord): Promise<void> {
    this.sharedVibeChecks.set(input.shareToken, input);
  }

  async markShareClicked(shareToken: string): Promise<boolean> {
    const existing = this.sharedVibeChecks.get(shareToken);
    if (!existing) {
      return false;
    }

    this.sharedVibeChecks.set(shareToken, {
      ...existing,
      clicked: true
    });

    return true;
  }

  async createInviteCode(inviteCode: InviteCodeRecord): Promise<InviteCodeRecord> {
    const existing = this.inviteCodes.get(inviteCode.userId);
    if (existing && !existing.disabledAt) {
      return existing;
    }

    const byCode = this.inviteCodesByCode.get(inviteCode.code);
    if (byCode && byCode.userId !== inviteCode.userId) {
      throw new Error('Invite code already exists.');
    }

    if (existing) {
      this.inviteCodesByCode.delete(existing.code);
    }
    this.inviteCodes.set(inviteCode.userId, inviteCode);
    this.inviteCodesByCode.set(inviteCode.code, inviteCode);
    return inviteCode;
  }

  async getInviteCodeByUserId(userId: string): Promise<InviteCodeRecord | null> {
    return this.inviteCodes.get(userId) ?? null;
  }

  async getInviteCodeByCode(code: string): Promise<InviteCodeRecord | null> {
    const inviteCode = this.inviteCodesByCode.get(code) ?? null;
    if (!inviteCode || inviteCode.disabledAt) {
      return null;
    }
    return inviteCode;
  }

  async createReferral(referral: ReferralRecord): Promise<ReferralRecord> {
    if (referral.inviteeUserId) {
      const existingForInvitee = [...this.referrals.values()].find((item) => item.inviteeUserId === referral.inviteeUserId);
      if (existingForInvitee) {
        throw new Error('Referral already exists for invitee.');
      }
    }

    this.referrals.set(referral.id, referral);
    return referral;
  }

  async getReferralByInviteeUserId(userId: string): Promise<ReferralRecord | null> {
    const referrals = [...this.referrals.values()]
      .filter((referral) => referral.inviteeUserId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return referrals[0] ?? null;
  }

  async updateReferral(referralId: string, update: Partial<ReferralRecord>): Promise<ReferralRecord | null> {
    const existing = this.referrals.get(referralId);
    if (!existing) {
      return null;
    }

    const next: ReferralRecord = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? existing.updatedAt
    };
    this.referrals.set(referralId, next);
    return next;
  }

  async countQualifiedReferralsByInviterUserId(userId: string): Promise<number> {
    return [...this.referrals.values()].filter(
      (referral) => referral.inviterUserId === userId && (referral.status === 'qualified' || referral.status === 'rewarded')
    ).length;
  }

  async createPriorityCredit(credit: PriorityCreditRecord): Promise<void> {
    const existing = [...this.priorityCredits.values()].find(
      (item) => item.referralId === credit.referralId && item.userId === credit.userId
    );
    if (existing) {
      return;
    }

    this.priorityCredits.set(credit.id, credit);
  }

  async countAvailablePriorityCredits(userId: string): Promise<number> {
    return [...this.priorityCredits.values()].filter((credit) => credit.userId === userId && credit.status === 'available').length;
  }

  async consumePriorityCreditsForDrop(dropId: string, consumedAt: string): Promise<string[]> {
    const matchedUsers = new Set<string>();
    for (const match of this.matches.values()) {
      if (match.dropId !== dropId) {
        continue;
      }
      matchedUsers.add(match.userAId);
      matchedUsers.add(match.userBId);
    }

    const consumedUsers: string[] = [];

    for (const userId of matchedUsers) {
      const alreadyConsumed = [...this.priorityCredits.values()].some(
        (credit) => credit.userId === userId && credit.consumedInDropId === dropId
      );
      if (alreadyConsumed) {
        continue;
      }

      const nextCredit = [...this.priorityCredits.values()]
        .filter((credit) => credit.userId === userId && credit.status === 'available')
        .sort((left, right) => left.availableAt.localeCompare(right.availableAt) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))[0];

      if (!nextCredit) {
        continue;
      }

      this.priorityCredits.set(nextCredit.id, {
        ...nextCredit,
        status: 'consumed',
        consumedAt,
        consumedInDropId: dropId
      });
      consumedUsers.push(userId);
    }

    return consumedUsers;
  }

  async getIdempotency(
    scope: string,
    userId: string,
    key: string
  ): Promise<{ statusCode: number; responseBody: unknown } | null> {
    return this.idempotency.get(`${scope}:${userId}:${key}`) ?? null;
  }

  async saveIdempotency(input: {
    scope: string;
    userId: string;
    key: string;
    statusCode: number;
    responseBody: unknown;
    createdAt: string;
  }): Promise<void> {
    this.idempotency.set(`${input.scope}:${input.userId}:${input.key}`, {
      statusCode: input.statusCode,
      responseBody: input.responseBody
    });
  }
}
