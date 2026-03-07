import postgres, { type Sql } from 'postgres';
import type { Repository } from './dependencies.js';
import type {
  DropRecord,
  IngestJobRecord,
  MatchRecord,
  MessageRecord,
  PreferencesRecord,
  ProfileIngestionRecord,
  ProfileRecord,
  RevealTokenRecord,
  SharedVibeCheckRecord,
  UserRecord
} from './model.js';

function parseVector(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => Number(value));
  }

  if (typeof raw !== 'string') {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));
}

function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined
  };
}

function mapProfile(row: any): ProfileRecord {
  return {
    userId: row.user_id,
    source: row.source,
    sanitizedSummary: row.sanitized_summary,
    vibeCheckCard: row.vibe_check_card ?? undefined,
    embedding: parseVector(row.embedding),
    embeddingModel: row.embedding_model,
    piiRiskScore: row.pii_risk_score,
    retentionExpiresAt: row.retention_expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapIngestion(row: any): ProfileIngestionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    storageBucket: row.storage_bucket,
    storageKey: row.storage_key,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    status: row.status,
    errorCode: row.error_code ?? undefined,
    piiRiskScore: row.pii_risk_score,
    rawMode: row.raw_mode,
    rawDeleteDueAt: row.raw_delete_due_at,
    rawDeletedAt: row.raw_deleted_at ?? undefined,
    rawDeleteAttempts: row.raw_delete_attempts,
    rawDeleteLastError: row.raw_delete_last_error ?? undefined,
    policyVersion: row.policy_version,
    uploadExpiresAt: row.upload_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapIngestJob(row: any): IngestJobRecord {
  return {
    id: row.id,
    ingestionId: row.ingestion_id,
    userId: row.user_id,
    state: row.state,
    progress: row.progress,
    errorCode: row.error_code ?? undefined,
    retryable: row.retryable,
    pollAfterMs: row.poll_after_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDrop(row: any): DropRecord {
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    mode: row.mode,
    poolSize: row.pool_size ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    createdAt: row.created_at
  };
}

function mapMatch(row: any): MatchRecord {
  return {
    id: row.id,
    dropId: row.drop_id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    status: row.status,
    synergyPoints: row.synergy_points,
    confessionPrompt: row.confession_prompt,
    userAConfession: row.user_a_confession ?? undefined,
    userBConfession: row.user_b_confession ?? undefined,
    responseDeadline: row.response_deadline,
    unlockedAt: row.unlocked_at ?? undefined,
    expiresAt: row.expires_at,
    version: row.version,
    createdAt: row.created_at
  };
}

function mapMessage(row: any): MessageRecord {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    clientMessageId: row.client_message_id,
    body: row.body,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at ?? undefined
  };
}

function mapRevealToken(row: any): RevealTokenRecord {
  return {
    tokenHash: row.token_hash,
    matchId: row.match_id,
    userId: row.user_id,
    artifactPath: row.artifact_path,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined
  };
}

export class PostgresRepository implements Repository {
  private readonly sql: Sql;

  constructor(databaseUrl: string, maxConnections = 10) {
    this.sql = postgres(databaseUrl, {
      max: maxConnections,
      prepare: false,
      idle_timeout: 20
    });
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  async upsertUser(user: UserRecord): Promise<UserRecord> {
    const [row] = await this.sql`
      insert into users (id, email, status, created_at, last_active_at, deleted_at)
      values (${user.id}, ${user.email}, ${user.status}, ${user.createdAt}, ${user.lastActiveAt ?? null}, ${user.deletedAt ?? null})
      on conflict (id) do update
      set email = excluded.email,
          status = excluded.status,
          last_active_at = excluded.last_active_at,
          deleted_at = excluded.deleted_at
      returning *
    `;
    return mapUser(row);
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const [row] = await this.sql`select * from users where id = ${userId} limit 1`;
    return row ? mapUser(row) : null;
  }

  async findOrCreateUserByEmail(email: string): Promise<UserRecord> {
    const [existing] = await this.sql`select * from users where email = ${email} limit 1`;
    if (existing) {
      return mapUser(existing);
    }

    const [created] = await this.sql`
      insert into users (email)
      values (${email})
      returning *
    `;
    return mapUser(created);
  }

  async setUserStatus(userId: string, status: UserRecord['status']): Promise<void> {
    await this.sql`
      update users
      set status = ${status},
          last_active_at = now()
      where id = ${userId}
    `;
  }

  async upsertProfile(profile: ProfileRecord): Promise<void> {
    await this.sql`
      insert into profiles (
        user_id,
        source,
        sanitized_summary,
        vibe_check_card,
        embedding,
        embedding_model,
        pii_risk_score,
        retention_expires_at,
        created_at,
        updated_at
      )
      values (
        ${profile.userId},
        ${profile.source},
        ${profile.sanitizedSummary},
        ${profile.vibeCheckCard ?? null},
        ${this.sql.unsafe(`'[${profile.embedding.join(',')}]'`)},
        ${profile.embeddingModel},
        ${profile.piiRiskScore},
        ${profile.retentionExpiresAt ?? null},
        ${profile.createdAt},
        ${profile.updatedAt}
      )
      on conflict (user_id) do update
      set source = excluded.source,
          sanitized_summary = excluded.sanitized_summary,
          vibe_check_card = excluded.vibe_check_card,
          embedding = excluded.embedding,
          embedding_model = excluded.embedding_model,
          pii_risk_score = excluded.pii_risk_score,
          retention_expires_at = excluded.retention_expires_at,
          updated_at = excluded.updated_at
    `;
  }

  async getProfileByUserId(userId: string): Promise<ProfileRecord | null> {
    const [row] = await this.sql`select * from profiles where user_id = ${userId} limit 1`;
    return row ? mapProfile(row) : null;
  }

  async createProfileIngestion(ingestion: ProfileIngestionRecord): Promise<void> {
    await this.sql`
      insert into profile_ingestions (
        id,
        user_id,
        source,
        storage_bucket,
        storage_key,
        sha256,
        size_bytes,
        status,
        error_code,
        pii_risk_score,
        raw_mode,
        raw_delete_due_at,
        raw_deleted_at,
        raw_delete_attempts,
        raw_delete_last_error,
        policy_version,
        upload_expires_at,
        created_at,
        updated_at
      ) values (
        ${ingestion.id},
        ${ingestion.userId},
        ${ingestion.source},
        ${ingestion.storageBucket},
        ${ingestion.storageKey},
        ${ingestion.sha256},
        ${ingestion.sizeBytes},
        ${ingestion.status},
        ${ingestion.errorCode ?? null},
        ${ingestion.piiRiskScore},
        ${ingestion.rawMode},
        ${ingestion.rawDeleteDueAt},
        ${ingestion.rawDeletedAt ?? null},
        ${ingestion.rawDeleteAttempts},
        ${ingestion.rawDeleteLastError ?? null},
        ${ingestion.policyVersion},
        ${ingestion.uploadExpiresAt},
        ${ingestion.createdAt},
        ${ingestion.updatedAt}
      )
    `;
  }

  async getProfileIngestionById(ingestionId: string): Promise<ProfileIngestionRecord | null> {
    const [row] = await this.sql`select * from profile_ingestions where id = ${ingestionId} limit 1`;
    return row ? mapIngestion(row) : null;
  }

  async getLatestProfileIngestionByUserId(userId: string): Promise<ProfileIngestionRecord | null> {
    const [row] = await this.sql`
      select * from profile_ingestions
      where user_id = ${userId}
      order by created_at desc
      limit 1
    `;
    return row ? mapIngestion(row) : null;
  }

  async updateProfileIngestion(
    ingestionId: string,
    update: Partial<ProfileIngestionRecord>
  ): Promise<ProfileIngestionRecord | null> {
    const existing = await this.getProfileIngestionById(ingestionId);
    if (!existing) {
      return null;
    }

    const merged = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString()
    };

    await this.sql`
      update profile_ingestions
      set source = ${merged.source},
          storage_bucket = ${merged.storageBucket},
          storage_key = ${merged.storageKey},
          sha256 = ${merged.sha256},
          size_bytes = ${merged.sizeBytes},
          status = ${merged.status},
          error_code = ${merged.errorCode ?? null},
          pii_risk_score = ${merged.piiRiskScore},
          raw_mode = ${merged.rawMode},
          raw_delete_due_at = ${merged.rawDeleteDueAt},
          raw_deleted_at = ${merged.rawDeletedAt ?? null},
          raw_delete_attempts = ${merged.rawDeleteAttempts},
          raw_delete_last_error = ${merged.rawDeleteLastError ?? null},
          policy_version = ${merged.policyVersion},
          upload_expires_at = ${merged.uploadExpiresAt},
          updated_at = ${merged.updatedAt}
      where id = ${ingestionId}
    `;

    return merged;
  }

  async createIngestJob(job: IngestJobRecord): Promise<void> {
    await this.sql`
      insert into ingest_jobs (
        id,
        ingestion_id,
        user_id,
        state,
        progress,
        error_code,
        retryable,
        poll_after_ms,
        created_at,
        updated_at
      ) values (
        ${job.id},
        ${job.ingestionId},
        ${job.userId},
        ${job.state},
        ${job.progress},
        ${job.errorCode ?? null},
        ${job.retryable},
        ${job.pollAfterMs},
        ${job.createdAt},
        ${job.updatedAt}
      )
    `;
  }

  async getIngestJobById(jobId: string): Promise<IngestJobRecord | null> {
    const [row] = await this.sql`select * from ingest_jobs where id = ${jobId} limit 1`;
    return row ? mapIngestJob(row) : null;
  }

  async updateIngestJob(jobId: string, update: Partial<IngestJobRecord>): Promise<IngestJobRecord | null> {
    const existing = await this.getIngestJobById(jobId);
    if (!existing) {
      return null;
    }

    const merged = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString()
    };

    await this.sql`
      update ingest_jobs
      set ingestion_id = ${merged.ingestionId},
          user_id = ${merged.userId},
          state = ${merged.state},
          progress = ${merged.progress},
          error_code = ${merged.errorCode ?? null},
          retryable = ${merged.retryable},
          poll_after_ms = ${merged.pollAfterMs},
          updated_at = ${merged.updatedAt}
      where id = ${jobId}
    `;

    return merged;
  }

  async upsertDrop(drop: DropRecord): Promise<void> {
    await this.sql`
      insert into drops (
        id,
        scheduled_at,
        status,
        mode,
        pool_size,
        failure_reason,
        started_at,
        finished_at,
        created_at
      )
      values (
        ${drop.id},
        ${drop.scheduledAt},
        ${drop.status},
        ${drop.mode},
        ${drop.poolSize ?? null},
        ${drop.failureReason ?? null},
        ${drop.startedAt ?? null},
        ${drop.finishedAt ?? null},
        ${drop.createdAt}
      )
      on conflict (id) do update
      set scheduled_at = excluded.scheduled_at,
          status = excluded.status,
          mode = excluded.mode,
          pool_size = excluded.pool_size,
          failure_reason = excluded.failure_reason,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at
    `;
  }

  async getRelevantDrop(nowIso: string): Promise<DropRecord | null> {
    const [active] = await this.sql`
      select *
      from drops
      where status in ('ingest_closed', 'matching', 'content_ready', 'published', 'notified', 'paused', 'failed')
      order by scheduled_at desc
      limit 1
    `;
    if (active) {
      return mapDrop(active);
    }

    const [upcoming] = await this.sql`
      select *
      from drops
      where status = 'scheduled' and scheduled_at >= ${nowIso}
      order by scheduled_at asc
      limit 1
    `;
    if (upcoming) {
      return mapDrop(upcoming);
    }

    const [lastScheduled] = await this.sql`
      select *
      from drops
      where status = 'scheduled'
      order by scheduled_at desc
      limit 1
    `;
    if (lastScheduled) {
      return mapDrop(lastScheduled);
    }

    const [open] = await this.sql`
      select *
      from drops
      where status <> 'closed'
      order by scheduled_at desc
      limit 1
    `;
    if (open) {
      return mapDrop(open);
    }

    const [latest] = await this.sql`
      select *
      from drops
      order by created_at desc
      limit 1
    `;
    return latest ? mapDrop(latest) : null;
  }

  async upsertPreferences(preferences: PreferencesRecord): Promise<void> {
    await this.sql`
      insert into preferences (user_id, gender_identity, attracted_to, age_min, age_max)
      values (${preferences.userId}, ${preferences.genderIdentity}, ${preferences.attractedTo}, ${preferences.ageMin}, ${preferences.ageMax})
      on conflict (user_id) do update
      set gender_identity = excluded.gender_identity,
          attracted_to = excluded.attracted_to,
          age_min = excluded.age_min,
          age_max = excluded.age_max
    `;
  }

  async getPreferencesByUserId(userId: string): Promise<PreferencesRecord | null> {
    const [row] = await this.sql`select * from preferences where user_id = ${userId} limit 1`;
    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      genderIdentity: row.gender_identity,
      attractedTo: row.attracted_to,
      ageMin: row.age_min,
      ageMax: row.age_max
    };
  }

  async upsertMatch(match: MatchRecord): Promise<void> {
    await this.sql`
      insert into matches (
        id,
        drop_id,
        user_a_id,
        user_b_id,
        status,
        synergy_points,
        confession_prompt,
        user_a_confession,
        user_b_confession,
        response_deadline,
        unlocked_at,
        expires_at,
        version,
        created_at
      ) values (
        ${match.id},
        ${match.dropId},
        ${match.userAId},
        ${match.userBId},
        ${match.status},
        ${this.sql.json(match.synergyPoints)},
        ${match.confessionPrompt},
        ${match.userAConfession ?? null},
        ${match.userBConfession ?? null},
        ${match.responseDeadline},
        ${match.unlockedAt ?? null},
        ${match.expiresAt},
        ${match.version},
        ${match.createdAt}
      )
      on conflict (id) do update
      set status = excluded.status,
          synergy_points = excluded.synergy_points,
          confession_prompt = excluded.confession_prompt,
          user_a_confession = excluded.user_a_confession,
          user_b_confession = excluded.user_b_confession,
          response_deadline = excluded.response_deadline,
          unlocked_at = excluded.unlocked_at,
          expires_at = excluded.expires_at,
          version = excluded.version
    `;
  }

  async getMatchById(matchId: string): Promise<MatchRecord | null> {
    const [row] = await this.sql`select * from matches where id = ${matchId} limit 1`;
    return row ? mapMatch(row) : null;
  }

  async getCurrentMatchByUserId(userId: string): Promise<MatchRecord | null> {
    const [row] = await this.sql`
      select * from matches
      where user_a_id = ${userId} or user_b_id = ${userId}
      order by created_at desc
      limit 1
    `;

    return row ? mapMatch(row) : null;
  }

  async updateMatch(matchId: string, update: Partial<MatchRecord>): Promise<MatchRecord | null> {
    const existing = await this.getMatchById(matchId);
    if (!existing) {
      return null;
    }

    const merged = {
      ...existing,
      ...update
    };

    await this.upsertMatch(merged);
    return merged;
  }

  async listMessages(matchId: string, cursor?: string, limit = 50): Promise<MessageRecord[]> {
    if (cursor) {
      const rows = await this.sql`
        select * from messages
        where match_id = ${matchId} and created_at > ${cursor} and deleted_at is null
        order by created_at asc
        limit ${limit}
      `;
      return rows.map(mapMessage);
    }

    const rows = await this.sql`
      select * from messages
      where match_id = ${matchId} and deleted_at is null
      order by created_at asc
      limit ${limit}
    `;
    return rows.map(mapMessage);
  }

  async getMessageByClientId(matchId: string, senderId: string, clientMessageId: string): Promise<MessageRecord | null> {
    const [row] = await this.sql`
      select * from messages
      where match_id = ${matchId} and sender_id = ${senderId} and client_message_id = ${clientMessageId}
      limit 1
    `;
    return row ? mapMessage(row) : null;
  }

  async createMessage(message: MessageRecord): Promise<void> {
    await this.sql`
      insert into messages (id, match_id, sender_id, client_message_id, body, created_at, expires_at, deleted_at)
      values (
        ${message.id},
        ${message.matchId},
        ${message.senderId},
        ${message.clientMessageId},
        ${message.body},
        ${message.createdAt},
        ${message.expiresAt},
        ${message.deletedAt ?? null}
      )
    `;
  }

  async upsertRevealToken(token: RevealTokenRecord): Promise<void> {
    await this.sql`
      insert into reveal_tokens (token_hash, match_id, user_id, artifact_path, expires_at, used_at)
      values (${token.tokenHash}, ${token.matchId}, ${token.userId}, ${token.artifactPath}, ${token.expiresAt}, ${token.usedAt ?? null})
      on conflict (token_hash) do update
      set match_id = excluded.match_id,
          user_id = excluded.user_id,
          artifact_path = excluded.artifact_path,
          expires_at = excluded.expires_at,
          used_at = excluded.used_at
    `;
  }

  async getRevealTokenByHash(tokenHash: string): Promise<RevealTokenRecord | null> {
    const [row] = await this.sql`select * from reveal_tokens where token_hash = ${tokenHash} limit 1`;
    return row ? mapRevealToken(row) : null;
  }

  async updateRevealToken(tokenHash: string, update: Partial<RevealTokenRecord>): Promise<RevealTokenRecord | null> {
    const existing = await this.getRevealTokenByHash(tokenHash);
    if (!existing) {
      return null;
    }

    const merged = {
      ...existing,
      ...update
    };

    await this.sql`
      update reveal_tokens
      set match_id = ${merged.matchId},
          user_id = ${merged.userId},
          artifact_path = ${merged.artifactPath},
          expires_at = ${merged.expiresAt},
          used_at = ${merged.usedAt ?? null}
      where token_hash = ${tokenHash}
    `;

    return merged;
  }

  async createReport(input: {
    matchId: string;
    reporterId: string;
    reportedId: string;
    reason: string;
    createdAt: string;
  }): Promise<void> {
    await this.sql`
      insert into reports (match_id, reporter_id, reported_id, reason, created_at)
      values (${input.matchId}, ${input.reporterId}, ${input.reportedId}, ${input.reason}, ${input.createdAt})
    `;
  }

  async countReportsByUserSince(input: { reporterId: string; sinceIso: string }): Promise<number> {
    const [row] = await this.sql`
      select count(*)::int as count
      from reports
      where reporter_id = ${input.reporterId} and created_at >= ${input.sinceIso}
    `;

    return row.count;
  }

  async upsertMatchFeedback(input: { matchId: string; userId: string; rating: number; createdAt: string }): Promise<void> {
    await this.sql`
      insert into match_feedback (match_id, user_id, rating, created_at)
      values (${input.matchId}, ${input.userId}, ${input.rating}, ${input.createdAt})
      on conflict (match_id, user_id) do update
      set rating = excluded.rating,
          created_at = excluded.created_at
    `;
  }

  async upsertSharedVibeCheck(input: SharedVibeCheckRecord): Promise<void> {
    await this.sql`
      insert into shared_vibe_checks (id, user_id, share_token, platform, clicked, created_at)
      values (${input.id}, ${input.userId}, ${input.shareToken}, ${input.platform ?? null}, ${input.clicked}, ${input.createdAt})
      on conflict (share_token) do update
      set user_id = excluded.user_id,
          platform = excluded.platform,
          clicked = excluded.clicked
    `;
  }

  async markShareClicked(shareToken: string): Promise<boolean> {
    const result = await this.sql`
      update shared_vibe_checks
      set clicked = true
      where share_token = ${shareToken}
    `;

    return result.count > 0;
  }

  async getIdempotency(
    scope: string,
    userId: string,
    key: string
  ): Promise<{ statusCode: number; responseBody: unknown } | null> {
    const [row] = await this.sql`
      select status_code, response_body
      from idempotency_keys
      where scope = ${scope} and user_id = ${userId} and idempotency_key = ${key}
      limit 1
    `;

    if (!row) {
      return null;
    }

    return {
      statusCode: row.status_code,
      responseBody: row.response_body
    };
  }

  async saveIdempotency(input: {
    scope: string;
    userId: string;
    key: string;
    statusCode: number;
    responseBody: unknown;
    createdAt: string;
  }): Promise<void> {
    await this.sql`
      insert into idempotency_keys (scope, user_id, idempotency_key, status_code, response_body, created_at)
      values (${input.scope}, ${input.userId}, ${input.key}, ${input.statusCode}, ${this.sql.json(input.responseBody as any)}, ${input.createdAt})
      on conflict (scope, user_id, idempotency_key) do nothing
    `;
  }
}
