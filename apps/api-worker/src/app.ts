import {
  confessionSchema,
  derivePhase,
  feedbackSchema,
  intakeSummarySchema,
  magicLinkSchema,
  preferencesSchema,
  referralClaimSchema,
  reportSchema,
  sendMessageSchema,
  uploadCompleteSchema,
  uploadInitSchema
} from '@contexted/shared';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import type { AppDependencies } from './dependencies.js';
import { InMemoryRepository } from './in-memory-repository.js';
import type { IngestionStatus, MatchRecord } from './model.js';
import {
  createAuthMiddleware,
  parseValidatedJson,
  requireIdempotencyKey,
  type AppEnv,
  withAppErrors
} from './http-utils.js';
import { runDrop } from './services/drop-run-service.js';
import { computeMessageEtag, getPollAfterMs, hashRevealToken, isMatchParticipant } from './utils.js';

const MAX_REFERRAL_REWARDS = 2;
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function asIngestionState(status: IngestionStatus | undefined): 'pending' | 'processing' | 'completed' | 'failed' | undefined {
  if (!status) {
    return undefined;
  }

  if (status === 'initiated' || status === 'queued') {
    return 'pending';
  }

  if (status === 'processing') {
    return 'processing';
  }

  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'failed' || status === 'expired') {
    return 'failed';
  }

  return undefined;
}

function matchStateForUser(match: MatchRecord, userId: string): {
  state: MatchRecord['status'];
  myConfession: string | null;
  partnerConfession: string | null;
} {
  const amUserA = match.userAId === userId;

  return {
    state: match.status,
    myConfession: amUserA ? match.userAConfession ?? null : match.userBConfession ?? null,
    partnerConfession: amUserA ? match.userBConfession ?? null : match.userAConfession ?? null
  };
}

function hasInternalAdminAccess(c: Context, deps: AppDependencies): boolean {
  const expected = deps.config.internalAdminToken?.trim();
  const provided = c.req.header('X-Internal-Admin-Token')?.trim();

  if (!expected || !provided || expected.length !== provided.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(provided);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function randomInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  return [...bytes]
    .map((value) => INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length])
    .join('');
}

async function ensureInviteCode(deps: AppDependencies, userId: string, nowIso: string): Promise<string> {
  const existing = await deps.repository.getInviteCodeByUserId(userId);
  if (existing && !existing.disabledAt) {
    return existing.code;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomInviteCode();
    try {
      const created = await deps.repository.createInviteCode({
        userId,
        code,
        createdAt: nowIso
      });
      return created.code;
    } catch {
      continue;
    }
  }

  throw new Error('Unable to create invite code.');
}

async function maybeRewardReferral(
  deps: AppDependencies,
  userId: string,
  nowIso: string,
  wasFirstQueueEntry: boolean
): Promise<void> {
  const referral = await deps.repository.getReferralByInviteeUserId(userId);
  if (!referral || referral.status !== 'claimed') {
    return;
  }

  if (!wasFirstQueueEntry || (await deps.repository.hasAnyMatchForUser(userId))) {
    await deps.repository.updateReferral(referral.id, {
      status: 'ineligible',
      ineligibleReason: 'existing_user',
      updatedAt: nowIso
    });
    return;
  }

  const landedReferrals = await deps.repository.countQualifiedReferralsByInviterUserId(referral.inviterUserId);
  if (landedReferrals >= MAX_REFERRAL_REWARDS) {
    await deps.repository.updateReferral(referral.id, {
      status: 'ineligible',
      ineligibleReason: 'reward_cap_reached',
      updatedAt: nowIso
    });
    return;
  }

  await deps.repository.createPriorityCredit({
    id: crypto.randomUUID(),
    userId: referral.inviterUserId,
    sourceType: 'referral_inviter',
    referralId: referral.id,
    status: 'available',
    availableAt: nowIso,
    createdAt: nowIso
  });

  await deps.repository.createPriorityCredit({
    id: crypto.randomUUID(),
    userId,
    sourceType: 'referral_invitee',
    referralId: referral.id,
    status: 'available',
    availableAt: nowIso,
    createdAt: nowIso
  });

  await deps.repository.updateReferral(referral.id, {
    status: 'rewarded',
    qualifiedAt: nowIso,
    rewardedAt: nowIso,
    updatedAt: nowIso
  });
}

export function createApp(deps: AppDependencies): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const allowedOrigins = deps.config.appPublicOrigin
    ? [deps.config.appPublicOrigin]
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.use('*', cors({
    origin: allowedOrigins,
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'If-None-Match', 'X-Internal-Admin-Token', 'X-App-Background'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    exposeHeaders: ['ETag'],
    maxAge: 86400,
    credentials: true,
  }));

  const requireAuth = createAuthMiddleware(deps);

  app.get('/health', (c) => c.json({ ok: true }));

  // In-memory upload sink: accepts PUT uploads so the browser XHR succeeds in dev/memory mode
  app.put('/r/upload-sink/*', (c) => c.json({ ok: true }));

  app.post(
    '/v1/referrals/claim',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const body = await parseValidatedJson(c, referralClaimSchema, deps);
      const nowIso = deps.clock().toISOString();

      const inviteCode = await deps.repository.getInviteCodeByCode(body.invite_code);
      if (!inviteCode) {
        return c.json({ code: 'STATE_CONFLICT', field: 'invite_code', message: 'Invite code not found.' }, 404);
      }

      if (inviteCode.userId === viewer.id) {
        return c.json({ code: 'STATE_CONFLICT', field: 'invite_code', message: 'You can’t claim your own invite.' }, 422);
      }

      const existing = await deps.repository.getReferralByInviteeUserId(viewer.id);
      if (existing) {
        return c.json({
          claimed: existing.inviteCode === inviteCode.code,
          eligible_for_reward: existing.status === 'claimed' || existing.status === 'qualified' || existing.status === 'rewarded',
          reason: existing.inviteCode === inviteCode.code ? existing.ineligibleReason ?? null : 'already_claimed'
        });
      }

      const viewerUser = await deps.repository.getUserById(viewer.id);
      if (!viewerUser) {
        return c.json({ code: 'STATE_CONFLICT', field: 'user', message: 'User not found.' }, 404);
      }
      const eligibleForReward = Boolean(viewerUser) && !viewerUser.queueEnteredAt && !(await deps.repository.hasAnyMatchForUser(viewer.id));

      await deps.repository.createReferral({
        id: crypto.randomUUID(),
        inviterUserId: inviteCode.userId,
        inviteeUserId: viewer.id,
        inviteCode: inviteCode.code,
        status: eligibleForReward ? 'claimed' : 'ineligible',
        ineligibleReason: eligibleForReward ? undefined : 'existing_user',
        claimedAt: eligibleForReward ? nowIso : undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      });

      return c.json({
        claimed: true,
        eligible_for_reward: eligibleForReward,
        reason: eligibleForReward ? null : 'existing_user'
      });
    })
  );

  app.get(
    '/v1/referrals/me',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const nowIso = deps.clock().toISOString();
      const inviteCode = await ensureInviteCode(deps, viewer.id, nowIso);
      const landedReferrals = await deps.repository.countQualifiedReferralsByInviterUserId(viewer.id);
      const availablePriorityCredits = await deps.repository.countAvailablePriorityCredits(viewer.id);
      const origin = deps.config.appPublicOrigin ?? new URL(c.req.url).origin;

      return c.json({
        invite_url: `${origin}/?invite=${inviteCode}`,
        invite_code: inviteCode,
        landed_referrals: landedReferrals,
        max_landed_referrals: MAX_REFERRAL_REWARDS,
        available_priority_credits: availablePriorityCredits,
        remaining_referral_rewards: Math.max(0, MAX_REFERRAL_REWARDS - landedReferrals),
        can_invite: landedReferrals < MAX_REFERRAL_REWARDS
      });
    })
  );

  app.post(
    '/v1/referrals/:invite_code/click',
    withAppErrors(async (c: Context) => {
      const inviteCode = await deps.repository.getInviteCodeByCode(c.req.param('invite_code').toUpperCase());
      if (!inviteCode) {
        return c.json({ code: 'STATE_CONFLICT', field: 'invite_code', message: 'Invite code not found.' }, 404);
      }

      const nowIso = deps.clock().toISOString();
      await deps.repository.createReferral({
        id: crypto.randomUUID(),
        inviterUserId: inviteCode.userId,
        inviteCode: inviteCode.code,
        status: 'clicked',
        createdAt: nowIso,
        updatedAt: nowIso
      });

      return c.json({ clicked: true });
    })
  );

  app.post(
    '/v1/auth/magic-link',
    withAppErrors(async (c: Context) => {
      const body = await parseValidatedJson(c, magicLinkSchema, deps);
      const user = await deps.repository.findOrCreateUserByEmail(body.email);
      await deps.repository.upsertUser({
        ...user,
        email: body.email,
        lastActiveAt: deps.clock().toISOString()
      });

      await deps.authService.sendMagicLink({
        email: body.email,
        redirectTo: body.redirect_to
      });

      return c.json({ sent: true });
    })
  );

  app.get(
    '/v1/bootstrap',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const user = await deps.repository.getUserById(viewer.id);
      if (!user) {
        return c.json({ code: 'STATE_CONFLICT', field: 'user', message: 'User not found.' }, 404);
      }

      const latestIngestion = await deps.repository.getLatestProfileIngestionByUserId(viewer.id);
      const match = await deps.repository.getCurrentMatchByUserId(viewer.id);
      const preferences = await deps.repository.getPreferencesByUserId(viewer.id);
      const nowIso = deps.clock().toISOString();

      const phase = derivePhase(
        {
          userStatus: user.status,
          ingestionState: asIngestionState(latestIngestion?.status),
          matchStatus: match?.status,
          chatExpiresAt: match?.expiresAt
        },
        nowIso
      );

      const drop = phase === 'waiting' ? await deps.repository.getRelevantDrop(nowIso) : null;

      return c.json({
        server_now: nowIso,
        phase,
        has_preferences: preferences !== null,
        drop: drop
          ? {
              id: drop.id,
              status: drop.status,
              scheduled_at: drop.scheduledAt,
              mode: drop.mode,
              pool_size: drop.poolSize ?? null,
              failure_reason: drop.failureReason ?? null,
              started_at: drop.startedAt ?? null,
              finished_at: drop.finishedAt ?? null
            }
          : null,
        intake: latestIngestion
          ? {
              ingestion_id: latestIngestion.id,
              state: latestIngestion.status,
              updated_at: latestIngestion.updatedAt
            }
          : null,
        match: match
          ? {
              match_id: match.id,
              state: match.status,
              deadline_at: match.responseDeadline,
              chat_expires_at: match.expiresAt,
              version: match.version
            }
          : null
      });
    })
  );

  app.post(
    '/v1/intake/summary',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const body = await parseValidatedJson(c, intakeSummarySchema, deps);
      const now = deps.clock();
      const nowIso = now.toISOString();
      const sourceText = body.provider_label
        ? `Provider: ${body.provider_label}\n\n${body.summary_text}`
        : body.summary_text;
      const ingestionId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      await deps.repository.createProfileIngestion({
        id: ingestionId,
        userId: viewer.id,
        source: body.source,
        storageBucket: 'summary-intake',
        storageKey: `${viewer.id}/${ingestionId}.txt`,
        sha256: '0'.repeat(64),
        sizeBytes: new TextEncoder().encode(sourceText).byteLength,
        status: 'queued',
        piiRiskScore: 0,
        rawMode: 'inline_summary',
        rawDeleteDueAt: new Date(now.getTime() + deps.config.rawHardTtlMinutes * 60000).toISOString(),
        rawDeletedAt: nowIso,
        rawDeleteAttempts: 0,
        policyVersion: deps.config.rawPolicyVersion,
        uploadExpiresAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      });

      await deps.repository.setUserStatus(viewer.id, 'processing');
      await deps.repository.createIngestJob({
        id: jobId,
        ingestionId,
        userId: viewer.id,
        state: 'queued',
        progress: 0,
        retryable: true,
        pollAfterMs: deps.config.processingPollMs,
        createdAt: nowIso,
        updatedAt: nowIso
      });

      await deps.queueService.enqueue('ingest', {
        ingestionId,
        jobId,
        userId: viewer.id,
        sourceText
      });

      return c.json({
        state: 'queued',
        job_id: jobId,
        ingestion_id: ingestionId
      });
    })
  );

  app.post(
    '/v1/uploads/init',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const body = await parseValidatedJson(c, uploadInitSchema, deps);

      const maxBytes = deps.config.maxUploadMb * 1024 * 1024;
      if (body.file_size > maxBytes) {
        return c.json(
          {
            code: 'OUT_OF_RANGE',
            field: 'file_size',
            message: `File exceeds max size of ${deps.config.maxUploadMb}MB.`
          },
          422
        );
      }

      const signedUpload = await deps.storageService.createSignedUpload({
        userId: viewer.id,
        source: body.source,
        fileName: body.file_name,
        expiresInSeconds: deps.config.signedUploadTtlSec,
        maxBytes
      });

      const now = deps.clock();
      const ingestionId = crypto.randomUUID();
      const ingestion = {
        id: ingestionId,
        userId: viewer.id,
        source: body.source,
        storageBucket: signedUpload.storageBucket,
        storageKey: signedUpload.storageKey,
        sha256: body.sha256,
        sizeBytes: body.file_size,
        status: 'initiated' as const,
        piiRiskScore: 0,
        rawMode: deps.config.rawModeDefault,
        rawDeleteDueAt: new Date(now.getTime() + deps.config.rawHardTtlMinutes * 60000).toISOString(),
        rawDeleteAttempts: 0,
        policyVersion: deps.config.rawPolicyVersion,
        uploadExpiresAt: signedUpload.expiresAt,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await deps.repository.createProfileIngestion(ingestion);
      await deps.repository.setUserStatus(viewer.id, 'processing');

      return c.json({
        ingestion_id: ingestionId,
        upload_url: signedUpload.uploadUrl,
        upload_headers: signedUpload.uploadHeaders,
        expires_at: signedUpload.expiresAt,
        max_bytes: signedUpload.maxBytes
      });
    })
  );

  app.post(
    '/v1/uploads/complete',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const key = requireIdempotencyKey(c);

      const cached = await deps.repository.getIdempotency('uploads.complete', viewer.id, key);
      if (cached) {
        return c.json(cached.responseBody, cached.statusCode as 200);
      }

      const body = await parseValidatedJson(c, uploadCompleteSchema, deps);
      const ingestion = await deps.repository.getProfileIngestionById(body.ingestion_id);
      if (!ingestion || ingestion.userId !== viewer.id) {
        return c.json({ code: 'STATE_CONFLICT', field: 'ingestion_id', message: 'Ingestion not found.' }, 404);
      }

      if (new Date(ingestion.uploadExpiresAt).getTime() < deps.clock().getTime()) {
        await deps.repository.updateProfileIngestion(ingestion.id, {
          status: 'expired',
          errorCode: 'UPLOAD_URL_EXPIRED'
        });

        return c.json(
          {
            code: 'STATE_CONFLICT',
            field: 'ingestion_id',
            message: 'Upload URL expired. Please re-upload.'
          },
          422
        );
      }

      const now = deps.clock().toISOString();
      const jobId = crypto.randomUUID();
      await deps.repository.updateProfileIngestion(ingestion.id, {
        status: 'queued',
        updatedAt: now
      });

      await deps.repository.createIngestJob({
        id: jobId,
        ingestionId: ingestion.id,
        userId: viewer.id,
        state: 'queued',
        progress: 0,
        retryable: true,
        pollAfterMs: deps.config.processingPollMs,
        createdAt: now,
        updatedAt: now
      });

      await deps.queueService.enqueue('ingest', {
        ingestionId: ingestion.id,
        jobId,
        userId: viewer.id
      });

      const response = {
        state: 'queued',
        job_id: jobId
      };

      await deps.repository.saveIdempotency({
        scope: 'uploads.complete',
        userId: viewer.id,
        key,
        statusCode: 200,
        responseBody: response,
        createdAt: now
      });

      return c.json(response);
    })
  );

  app.get(
    '/v1/ingest/jobs/:job_id',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const jobId = c.req.param('job_id');

      const job = await deps.repository.getIngestJobById(jobId);
      if (!job || job.userId !== viewer.id) {
        return c.json({ code: 'STATE_CONFLICT', field: 'job_id', message: 'Job not found.' }, 404);
      }

      return c.json({
        state: job.state,
        progress: job.progress,
        error_code: job.errorCode ?? null,
        retryable: job.retryable,
        poll_after_ms: job.pollAfterMs
      });
    })
  );

  app.post(
    '/v1/preferences',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const body = await parseValidatedJson(c, preferencesSchema, deps);

      await deps.repository.upsertPreferences({
        userId: viewer.id,
        genderIdentity: body.gender_identity,
        attractedTo: body.attracted_to,
        ageMin: body.age_min,
        ageMax: body.age_max
      });

      return c.json({ saved: true });
    })
  );

  app.post(
    '/v1/waitlist/enroll',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const nowIso = deps.clock().toISOString();
      const profile = await deps.repository.getProfileByUserId(viewer.id);
      const preferences = await deps.repository.getPreferencesByUserId(viewer.id);
      const user = await deps.repository.getUserById(viewer.id);

      if (!user) {
        return c.json({ code: 'STATE_CONFLICT', field: 'user', message: 'User not found.' }, 404);
      }

      if (!profile) {
        return c.json({ code: 'STATE_CONFLICT', field: 'profile', message: 'Profile processing is incomplete.' }, 422);
      }

      if (!preferences) {
        return c.json({ code: 'STATE_CONFLICT', field: 'preferences', message: 'Preferences are required.' }, 422);
      }

      await deps.repository.upsertUser({
        ...user,
        status: 'waiting',
        queueEnteredAt: user.queueEnteredAt ?? nowIso,
        lastActiveAt: nowIso
      });
      await maybeRewardReferral(deps, viewer.id, nowIso, !user.queueEnteredAt);
      return c.json({ enrolled: true, status: 'waiting' });
    })
  );

  app.get(
    '/v1/matches/current',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const match = await deps.repository.getCurrentMatchByUserId(viewer.id);

      if (!match) {
        return c.json({
          match_id: null,
          state: 'none',
          synergy_points: [],
          confession_prompt: null,
          my_confession: null,
          partner_confession: null,
          deadline_at: null,
          chat_expires_at: null,
          version: 0,
          poll_after_ms: deps.config.processingPollMs
        });
      }

      const state = matchStateForUser(match, viewer.id);

      return c.json({
        match_id: match.id,
        state: state.state,
        synergy_points: match.synergyPoints,
        confession_prompt: match.confessionPrompt,
        my_confession: state.myConfession,
        partner_confession: state.partnerConfession,
        deadline_at: match.responseDeadline,
        chat_expires_at: match.expiresAt,
        version: match.version,
        poll_after_ms: getPollAfterMs(false, deps.config.chatPollForegroundSec, deps.config.chatPollBackgroundSec)
      });
    })
  );

  app.post(
    '/v1/matches/:id/confession',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const idempotencyKey = requireIdempotencyKey(c);
      const scope = `matches.confession.${c.req.param('id')}`;

      const cached = await deps.repository.getIdempotency(scope, viewer.id, idempotencyKey);
      if (cached) {
        return c.json(cached.responseBody, cached.statusCode as 200);
      }

      const body = await parseValidatedJson(c, confessionSchema, deps);
      const match = await deps.repository.getMatchById(c.req.param('id'));
      if (!match || !isMatchParticipant(match, viewer.id)) {
        return c.json({ code: 'STATE_CONFLICT', field: 'id', message: 'Match not found.' }, 404);
      }

      if (new Date(match.responseDeadline).getTime() < deps.clock().getTime()) {
        return c.json(
          {
            code: 'STATE_CONFLICT',
            field: 'response_deadline',
            message: 'Confession deadline has passed.'
          },
          422
        );
      }

      if (match.version !== body.expected_version) {
        return c.json(
          {
            code: 'STATE_CONFLICT',
            field: 'expected_version',
            message: 'Version mismatch.',
            state: match.status,
            version: match.version
          },
          409
        );
      }

      const amUserA = match.userAId === viewer.id;
      const alreadySubmitted = amUserA ? match.userAConfession : match.userBConfession;

      const nextVersion = alreadySubmitted ? match.version : match.version + 1;
      const nextMatch: MatchRecord = {
        ...match,
        userAConfession: amUserA ? body.answer : match.userAConfession,
        userBConfession: amUserA ? match.userBConfession : body.answer,
        version: nextVersion
      };

      if (nextMatch.userAConfession && nextMatch.userBConfession) {
        nextMatch.status = 'unlocked';
        nextMatch.unlockedAt = deps.clock().toISOString();
        nextMatch.expiresAt = new Date(deps.clock().getTime() + 24 * 60 * 60 * 1000).toISOString();
      }

      await deps.repository.updateMatch(match.id, nextMatch);

      const response = {
        state: nextMatch.status,
        version: nextMatch.version
      };

      await deps.repository.saveIdempotency({
        scope,
        userId: viewer.id,
        key: idempotencyKey,
        statusCode: 200,
        responseBody: response,
        createdAt: deps.clock().toISOString()
      });

      return c.json(response);
    })
  );

  app.get(
    '/r/:token',
    withAppErrors(async (c: Context) => {
      const tokenHash = await hashRevealToken(c.req.param('token'));
      const revealToken = await deps.repository.getRevealTokenByHash(tokenHash);
      if (!revealToken) {
        return c.json({ code: 'STATE_CONFLICT', field: 'token', message: 'Reveal token not found.' }, 404);
      }

      if (new Date(revealToken.expiresAt).getTime() < deps.clock().getTime()) {
        return c.json({ code: 'STATE_CONFLICT', field: 'token', message: 'Reveal token expired.' }, 410);
      }

      if (!revealToken.usedAt) {
        await deps.repository.updateRevealToken(tokenHash, {
          usedAt: deps.clock().toISOString()
        });
      }

      const artifact = await deps.storageService.readArtifact(revealToken.artifactPath);
      return c.json(artifact);
    })
  );

  app.get(
    '/v1/matches/:id/messages',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const match = await deps.repository.getMatchById(c.req.param('id'));
      if (!match || !isMatchParticipant(match, viewer.id)) {
        return c.json({ code: 'STATE_CONFLICT', field: 'id', message: 'Match not found.' }, 404);
      }

      if (match.status !== 'unlocked' || new Date(match.expiresAt).getTime() <= deps.clock().getTime()) {
        return c.json({ code: 'STATE_CONFLICT', field: 'match', message: 'Chat is unavailable.' }, 422);
      }

      const cursor = c.req.query('cursor');
      const items = await deps.repository.listMessages(match.id, cursor);
      const etag = computeMessageEtag(match.id, items);
      const ifNoneMatch = c.req.header('If-None-Match');

      if (ifNoneMatch && ifNoneMatch === etag) {
        c.header('ETag', etag);
        return new Response(null, { status: 304 });
      }

      c.header('ETag', etag);
      const background = c.req.header('X-App-Background') === '1';

      return c.json({
        items,
        next_cursor: items.at(-1)?.createdAt ?? null,
        poll_after_ms: getPollAfterMs(background, deps.config.chatPollForegroundSec, deps.config.chatPollBackgroundSec),
        chat_expires_at: match.expiresAt
      });
    })
  );

  app.post(
    '/v1/matches/:id/messages',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const match = await deps.repository.getMatchById(c.req.param('id'));
      if (!match || !isMatchParticipant(match, viewer.id)) {
        return c.json({ code: 'STATE_CONFLICT', field: 'id', message: 'Match not found.' }, 404);
      }

      if (match.status !== 'unlocked' || new Date(match.expiresAt).getTime() <= deps.clock().getTime()) {
        return c.json({ code: 'STATE_CONFLICT', field: 'match', message: 'Chat is unavailable.' }, 422);
      }

      const body = await parseValidatedJson(c, sendMessageSchema, deps);
      const existing = await deps.repository.getMessageByClientId(match.id, viewer.id, body.client_message_id);
      if (existing) {
        return c.json(existing);
      }

      const now = deps.clock().toISOString();
      const message = {
        id: crypto.randomUUID(),
        matchId: match.id,
        senderId: viewer.id,
        clientMessageId: body.client_message_id,
        body: body.body,
        createdAt: now,
        expiresAt: match.expiresAt
      };

      await deps.repository.createMessage(message);
      return c.json(message, 201);
    })
  );

  app.post(
    '/v1/matches/:id/read',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const match = await deps.repository.getMatchById(c.req.param('id'));
      if (!match || !isMatchParticipant(match, viewer.id)) {
        return c.json({ code: 'STATE_CONFLICT', field: 'id', message: 'Match not found.' }, 404);
      }

      return c.json({ ok: true });
    })
  );

  app.post(
    '/v1/reports',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const body = await parseValidatedJson(c, reportSchema, deps);
      const match = await deps.repository.getMatchById(body.match_id);
      if (!match || !isMatchParticipant(match, viewer.id)) {
        return c.json({ code: 'STATE_CONFLICT', field: 'match_id', message: 'Match not found.' }, 404);
      }

      const dayStart = new Date(deps.clock().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
      const count = await deps.repository.countReportsByUserSince({
        reporterId: viewer.id,
        sinceIso: dayStart
      });

      if (count >= 5) {
        return c.json({ code: 'STATE_CONFLICT', field: 'reports', message: 'Daily report limit reached.' }, 429);
      }

      await deps.repository.createReport({
        matchId: body.match_id,
        reporterId: viewer.id,
        reportedId: body.reported_id,
        reason: body.reason,
        createdAt: deps.clock().toISOString()
      });

      return c.json({ submitted: true });
    })
  );

  app.post(
    '/v1/matches/:id/feedback',
    requireAuth,
    withAppErrors(async (c: Context<AppEnv>) => {
      const viewer = c.get('viewer');
      const body = await parseValidatedJson(c, feedbackSchema, deps);
      const match = await deps.repository.getMatchById(c.req.param('id'));
      if (!match || !isMatchParticipant(match, viewer.id)) {
        return c.json({ code: 'STATE_CONFLICT', field: 'id', message: 'Match not found.' }, 404);
      }

      await deps.repository.upsertMatchFeedback({
        matchId: match.id,
        userId: viewer.id,
        rating: body.rating,
        createdAt: deps.clock().toISOString()
      });

      return c.json({ saved: true });
    })
  );

  app.post(
    '/v1/vibe-share/:share_token/click',
    withAppErrors(async (c: Context) => {
      const ok = await deps.repository.markShareClicked(c.req.param('share_token'));
      if (!ok) {
        return c.json({ code: 'STATE_CONFLICT', field: 'share_token', message: 'Share token not found.' }, 404);
      }

      return c.json({ clicked: true });
    })
  );

  app.post(
    '/v1/internal/drops/run',
    withAppErrors(async (c: Context) => {
      if (!hasInternalAdminAccess(c, deps)) {
        return c.json({ code: 'STATE_CONFLICT', message: 'Invalid internal admin token.' }, 403);
      }

      const result = await runDrop(deps);
      if (result.status === 'published') {
        await deps.repository.consumePriorityCreditsForDrop(result.dropId, deps.clock().toISOString());
      }
      const statusCode = result.status === 'published' ? 200 : 422;

      return c.json(
        {
          drop_id: result.dropId,
          pool_size: result.poolSize,
          pairs_created: result.pairsCreated,
          status: result.status,
          failure_reason: result.failureReason ?? null
        },
        statusCode as any
      );
    })
  );

  app.post(
    '/v1/dev/trigger-drop',
    withAppErrors(async (c: Context) => {
      if (!(deps.repository instanceof InMemoryRepository)) {
        return c.json({ code: 'STATE_CONFLICT', message: 'Dev endpoints are only available in memory mode.' }, 403);
      }

      const repo = deps.repository;
      const allUsers = [...repo.users.values()];
      const waitingUsers = allUsers.filter((u) => u.status === 'waiting');

      if (waitingUsers.length === 0) {
        return c.json({ code: 'STATE_CONFLICT', message: 'No waiting users found.' }, 422);
      }

      if (waitingUsers.length < 2) {
        const partnerId = '00000000-0000-4000-8000-000000000002';
        const existing = await repo.getUserById(partnerId);
        if (!existing) {
          await repo.upsertUser({
            id: partnerId,
            email: 'partner@contexted.local',
            status: 'waiting',
            createdAt: deps.clock().toISOString(),
            lastActiveAt: deps.clock().toISOString()
          });
          await repo.upsertProfile({
            userId: partnerId,
            source: 'chatgpt',
            matchText: 'A creative thinker who loves music, philosophy, and late-night conversations about the meaning of life.',
            sanitizedSummary: 'A creative thinker who loves music, philosophy, and late-night conversations about the meaning of life.',
            vibeCheckCard: 'You chase ideas with infectious energy and question everything twice.',
            embedding: new Array(1536).fill(0.5),
            embeddingModel: deps.config.embeddingModel,
            piiRiskScore: 0,
            createdAt: deps.clock().toISOString(),
            updatedAt: deps.clock().toISOString()
          });
          await repo.upsertPreferences({
            userId: partnerId,
            genderIdentity: 'NB',
            attractedTo: ['M', 'F', 'NB'],
            ageMin: 18,
            ageMax: 50
          });
        }
        waitingUsers.push(
          (await repo.getUserById(partnerId))!
        );
      }

      const result = await runDrop(deps);
      if (result.status === 'published') {
        await deps.repository.consumePriorityCreditsForDrop(result.dropId, deps.clock().toISOString());
      }
      const statusCode = result.status === 'published' ? 200 : 422;

      return c.json(
        {
          drop_id: result.dropId,
          pool_size: result.poolSize,
          pairs_created: result.pairsCreated,
          status: result.status,
          failure_reason: result.failureReason ?? null
        },
        statusCode as any
      );
    })
  );

  app.post(
    '/v1/dev/partner-confess',
    withAppErrors(async (c: Context) => {
      if (!(deps.repository instanceof InMemoryRepository)) {
        return c.json({ code: 'STATE_CONFLICT', message: 'Dev endpoints are only available in memory mode.' }, 403);
      }

      const repo = deps.repository;
      const matches = [...repo.matches.values()].filter((m) => m.status === 'pending_confession');
      if (matches.length === 0) {
        return c.json({ code: 'STATE_CONFLICT', message: 'No pending matches found.' }, 422);
      }

      const match = matches[0];
      const partnerId = match.userBId;
      const now = deps.clock();

      const nextMatch: MatchRecord = {
        ...match,
        userBConfession: 'I stopped chasing certainty and started embracing curiosity. It made everything richer.',
        version: match.version + 1
      };

      if (nextMatch.userAConfession && nextMatch.userBConfession) {
        nextMatch.status = 'unlocked';
        nextMatch.unlockedAt = now.toISOString();
        nextMatch.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      }

      await repo.updateMatch(match.id, nextMatch);

      return c.json({
        match_id: match.id,
        partner_id: partnerId,
        state: nextMatch.status,
        version: nextMatch.version
      });
    })
  );

  return app;
}
