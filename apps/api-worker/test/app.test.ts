import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createInMemoryDependencies } from '../src/factories.js';
import { resetRateLimitersForTests } from '../src/http-utils.js';
import { processIngestionJob } from '../src/services/ingestion-service.js';
import { hashRevealToken } from '../src/utils.js';

async function buildTestApp() {
  const factory = createInMemoryDependencies();
  let now = new Date('2026-03-03T12:00:00.000Z');
  factory.deps.clock = () => new Date(now);
  factory.deps.config.internalAdminToken = 'test-admin';

  const user = {
    id: crypto.randomUUID(),
    email: 'tester@example.com',
    status: 'waiting' as const,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString()
  };

  await factory.repository.upsertUser(user);
  factory.auth.seedToken('token-user', { id: user.id, email: user.email });

  const app = createApp(factory.deps);

  return {
    app,
    user,
    auth: factory.auth,
    deps: factory.deps,
    repository: factory.repository,
    storage: factory.storage,
    queue: factory.queue,
    advanceClock: (minutes: number) => {
      now = new Date(now.getTime() + minutes * 60_000);
    }
  };
}

function vectorWithPeak(index: number, peak = 1): number[] {
  const vector = new Array(1536).fill(0);
  vector[index] = peak;
  return vector;
}

async function seedEligibleWaitingUser(
  setup: Awaited<ReturnType<typeof buildTestApp>>,
  input: {
    userId: string;
    email: string;
    genderIdentity: 'M' | 'F' | 'NB';
    attractedTo: Array<'M' | 'F' | 'NB'>;
    embeddingIndex: number;
    peak?: number;
    matchText: string;
  }
) {
  await setup.repository.upsertUser({
    id: input.userId,
    email: input.email,
    status: 'waiting',
    createdAt: setup.deps.clock().toISOString(),
    lastActiveAt: setup.deps.clock().toISOString()
  });
  await setup.repository.upsertProfile({
    userId: input.userId,
    source: 'chatgpt',
    matchText: input.matchText,
    sanitizedSummary: input.matchText,
    vibeCheckCard: 'vibe',
    embedding: vectorWithPeak(input.embeddingIndex, input.peak ?? 1),
    embeddingModel: setup.deps.config.embeddingModel,
    piiRiskScore: 0,
    createdAt: setup.deps.clock().toISOString(),
    updatedAt: setup.deps.clock().toISOString()
  });
  await setup.repository.upsertPreferences({
    userId: input.userId,
    genderIdentity: input.genderIdentity,
    attractedTo: input.attractedTo,
    ageMin: 24,
    ageMax: 40
  });
}

describe('api worker', () => {
  beforeEach(() => {
    resetRateLimitersForTests();
  });

  afterEach(() => {
    resetRateLimitersForTests();
    vi.useRealTimers();
  });

  it('sends magic links and normalizes stored email', async () => {
    const setup = await buildTestApp();

    const response = await setup.app.request('/v1/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '  NewUser@Example.com  ',
        redirect_to: 'https://contexted.app/auth/verify'
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sent: true,
      dev_verify_url: expect.stringContaining('https://contexted.app/auth/verify#access_token=')
    });

    const created = [...setup.repository.users.values()].find((user) => user.email === 'newuser@example.com');
    expect(created).toBeDefined();
  });

  it('rejects unauthorized bootstrap requests', async () => {
    const setup = await buildTestApp();
    const response = await setup.app.request('/v1/bootstrap');
    expect(response.status).toBe(401);
  });

  it('returns relevant drop data in bootstrap while waiting', async () => {
    const setup = await buildTestApp();
    const scheduledAt = new Date(setup.deps.clock().getTime() + 2 * 60 * 60_000).toISOString();

    await setup.repository.upsertDrop({
      id: 'drop-1',
      scheduledAt,
      status: 'matching',
      mode: 'global',
      poolSize: 42,
      startedAt: setup.deps.clock().toISOString(),
      createdAt: setup.deps.clock().toISOString()
    });

    const response = await setup.app.request('/v1/bootstrap', {
      headers: { Authorization: 'Bearer token-user' }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      phase: 'waiting',
      drop: {
        id: 'drop-1',
        status: 'matching',
        scheduled_at: scheduledAt,
        mode: 'global',
        pool_size: 42,
        failure_reason: null,
        finished_at: null
      }
    });
  });

  it('rate limits magic-link requests across recreated apps using cf-connecting-ip first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T12:00:00.000Z'));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const setup = await buildTestApp();
      const response = await setup.app.request('/v1/auth/magic-link', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '198.51.100.24',
          'Content-Type': 'application/json',
          'X-Forwarded-For': `203.0.113.${attempt + 1}`
        },
        body: JSON.stringify({
          email: `newuser${attempt}@example.com`,
          redirect_to: 'https://contexted.app/auth/verify'
        })
      });

      expect(response.status).toBe(200);
    }

    const setup = await buildTestApp();
    const response = await setup.app.request('/v1/auth/magic-link', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '198.51.100.24',
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.250'
      },
      body: JSON.stringify({
        email: 'blocked@example.com',
        redirect_to: 'https://contexted.app/auth/verify'
      })
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.'
    });
  });

  it('handles upload init + complete idempotently', async () => {
    const setup = await buildTestApp();

    const init = await setup.app.request('/v1/uploads/init', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'chatgpt',
        file_name: 'memory.json',
        file_size: 1024,
        sha256: 'a'.repeat(64)
      })
    });

    expect(init.status).toBe(200);
    const initBody = await init.json();

    const completeOne = await setup.app.request('/v1/uploads/complete', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-upload-1'
      },
      body: JSON.stringify({
        ingestion_id: initBody.ingestion_id
      })
    });

    expect(completeOne.status).toBe(200);
    const completeBodyOne = await completeOne.json();

    const completeTwo = await setup.app.request('/v1/uploads/complete', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-upload-1'
      },
      body: JSON.stringify({
        ingestion_id: initBody.ingestion_id
      })
    });

    expect(completeTwo.status).toBe(200);
    const completeBodyTwo = await completeTwo.json();
    expect(completeBodyTwo).toEqual(completeBodyOne);
    expect(setup.queue.enqueued).toHaveLength(1);
  });

  it('creates ingest job from summary intake', async () => {
    const setup = await buildTestApp();

    const response = await setup.app.request('/v1/intake/summary', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary_text: 'I ask AI to reflect my blind spots and over-index on meaning.',
        source: 'both',
        provider_label: 'Gemini'
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state).toBe('queued');
    expect(typeof body.job_id).toBe('string');
    expect(typeof body.ingestion_id).toBe('string');

    const job = await setup.repository.getIngestJobById(body.job_id as string);
    expect(job?.state).toBe('queued');

    const ingestion = await setup.repository.getProfileIngestionById(body.ingestion_id as string);
    expect(ingestion?.status).toBe('queued');
    expect(ingestion?.source).toBe('both');
    expect(ingestion?.storageBucket).toBe('summary-intake');

    expect(setup.queue.enqueued).toHaveLength(1);
    expect(setup.queue.enqueued[0]?.payload.sourceText).toBe(
      'Provider: Gemini\n\nI ask AI to reflect my blind spots and over-index on meaning.'
    );
  });

  it('rejects internal drop runs without the admin token', async () => {
    const setup = await buildTestApp();

    const response = await setup.app.request('/v1/internal/drops/run', {
      method: 'POST'
    });

    expect(response.status).toBe(403);
  });

  it('validates provider_label for source=both summary intake', async () => {
    const setup = await buildTestApp();

    const response = await setup.app.request('/v1/intake/summary', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary_text: 'I think in systems and story arcs.',
        source: 'both'
      })
    });

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.field).toBe('provider_label');
  });

  it('enforces confession optimistic concurrency and unlocks chat', async () => {
    const setup = await buildTestApp();

    const partnerId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'matched',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    setup.auth.seedToken('token-partner', { id: partnerId, email: 'partner@example.com' });
    await setup.repository.upsertMatch({
      id: 'match-1',
      dropId: 'drop-1',
      userAId: setup.user.id,
      userBId: partnerId,
      status: 'pending_confession',
      synergyPoints: ['One', 'Two'],
      confessionPrompt: 'Prompt',
      responseDeadline: new Date(setup.deps.clock().getTime() + 30 * 60_000).toISOString(),
      expiresAt: new Date(setup.deps.clock().getTime() + 5 * 60 * 60_000).toISOString(),
      version: 0,
      createdAt: setup.deps.clock().toISOString()
    });

    const first = await setup.app.request('/v1/matches/match-1/confession', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'confess-1'
      },
      body: JSON.stringify({ answer: 'first answer', expected_version: 0 })
    });

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ state: 'pending_confession', version: 1 });

    const conflict = await setup.app.request('/v1/matches/match-1/confession', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'confess-2'
      },
      body: JSON.stringify({ answer: 'stale answer', expected_version: 0 })
    });

    expect(conflict.status).toBe(409);

    const second = await setup.app.request('/v1/matches/match-1/confession', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-partner',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'confess-3'
      },
      body: JSON.stringify({ answer: 'partner answer', expected_version: 1 })
    });

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ state: 'unlocked', version: 2 });
  });

  it('returns 304 on message poll with matching ETag', async () => {
    const setup = await buildTestApp();

    const partnerId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'matched',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });

    await setup.repository.upsertMatch({
      id: 'match-2',
      dropId: 'drop-1',
      userAId: setup.user.id,
      userBId: partnerId,
      status: 'unlocked',
      synergyPoints: ['One', 'Two'],
      confessionPrompt: 'Prompt',
      responseDeadline: new Date(setup.deps.clock().getTime() + 30 * 60_000).toISOString(),
      expiresAt: new Date(setup.deps.clock().getTime() + 5 * 60 * 60_000).toISOString(),
      version: 2,
      createdAt: setup.deps.clock().toISOString()
    });

    const send = await setup.app.request('/v1/matches/match-2/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_message_id: 'm-1', body: 'hello' })
    });

    expect(send.status).toBe(201);

    const list = await setup.app.request('/v1/matches/match-2/messages', {
      headers: {
        Authorization: 'Bearer token-user'
      }
    });

    expect(list.status).toBe(200);
    const etag = list.headers.get('ETag');
    expect(etag).toBeTruthy();

    const notModified = await setup.app.request('/v1/matches/match-2/messages', {
      headers: {
        Authorization: 'Bearer token-user',
        'If-None-Match': etag ?? ''
      }
    });

    expect(notModified.status).toBe(304);
  });

  it('applies report daily rate limits', async () => {
    const setup = await buildTestApp();
    const partnerId = crypto.randomUUID();
    const matchId = crypto.randomUUID();

    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'matched',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });

    await setup.repository.upsertMatch({
      id: matchId,
      dropId: 'drop-1',
      userAId: setup.user.id,
      userBId: partnerId,
      status: 'pending_confession',
      synergyPoints: ['One', 'Two'],
      confessionPrompt: 'Prompt',
      responseDeadline: new Date(setup.deps.clock().getTime() + 30 * 60_000).toISOString(),
      expiresAt: new Date(setup.deps.clock().getTime() + 5 * 60 * 60_000).toISOString(),
      version: 0,
      createdAt: setup.deps.clock().toISOString()
    });

    for (let index = 0; index < 5; index += 1) {
      const response = await setup.app.request('/v1/reports', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          match_id: matchId,
          reported_id: partnerId,
          reason: `reason-${index}`
        })
      });

      expect(response.status).toBe(200);
    }

    const limited = await setup.app.request('/v1/reports', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        match_id: matchId,
        reported_id: partnerId,
        reason: 'too many'
      })
    });

    expect(limited.status).toBe(429);
  });

  it('enrolls waitlist only after profile and preferences exist', async () => {
    const setup = await buildTestApp();

    const firstAttempt = await setup.app.request('/v1/waitlist/enroll', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user'
      }
    });
    expect(firstAttempt.status).toBe(422);

    await setup.repository.upsertProfile({
      userId: setup.user.id,
      source: 'chatgpt',
      matchText: 'summary',
      sanitizedSummary: 'summary',
      vibeCheckCard: 'vibe',
      embedding: new Array(1536).fill(0),
      embeddingModel: 'text-embedding-3-small',
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });

    await setup.repository.upsertPreferences({
      userId: setup.user.id,
      genderIdentity: 'M',
      attractedTo: ['F'],
      ageMin: 24,
      ageMax: 31
    });

    const secondAttempt = await setup.app.request('/v1/waitlist/enroll', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user'
      }
    });
    expect(secondAttempt.status).toBe(200);
  });

  it('returns the current derived profile for the viewer', async () => {
    const setup = await buildTestApp();

    await setup.repository.upsertProfile({
      userId: setup.user.id,
      source: 'claude',
      matchText: 'systems, honesty, and writing',
      sanitizedSummary: 'Keeps returning to systems, honesty, and writing as a way to feel grounded.',
      vibeCheckCard: 'You think in drafts, keep asking better questions, and trust emotional precision over noise.',
      embedding: new Array(1536).fill(0.1),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 25,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });

    const response = await setup.app.request('/v1/profile/me', {
      headers: { Authorization: 'Bearer token-user' }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      source: 'claude',
      sanitized_summary: 'Keeps returning to systems, honesty, and writing as a way to feel grounded.',
      vibe_check_card: 'You think in drafts, keep asking better questions, and trust emotional precision over noise.',
      pii_risk_score: 25,
      updated_at: setup.deps.clock().toISOString()
    });
  });

  it('serves reveal artifacts and respects token expiry', async () => {
    const setup = await buildTestApp();
    const matchId = crypto.randomUUID();
    const token = 'reveal-token';
    const tokenHash = await hashRevealToken(token);
    const artifactPath = 'reveal/match.json';

    setup.storage.seedArtifact(artifactPath, { synergy_points: ['A', 'B'] });

    await setup.repository.upsertRevealToken({
      tokenHash,
      matchId,
      userId: setup.user.id,
      artifactPath,
      expiresAt: new Date(setup.deps.clock().getTime() + 60_000).toISOString()
    });

    const ok = await setup.app.request(`/r/${token}`);
    expect(ok.status).toBe(200);

    await setup.repository.upsertRevealToken({
      tokenHash: await hashRevealToken('expired-token'),
      matchId,
      userId: setup.user.id,
      artifactPath,
      expiresAt: new Date(setup.deps.clock().getTime() - 60_000).toISOString()
    });
    const expired = await setup.app.request('/r/expired-token');
    expect(expired.status).toBe(410);
  });

  it('handles share-click tracking', async () => {
    const setup = await buildTestApp();

    const missing = await setup.app.request('/v1/vibe-share/unknown/click', { method: 'POST' });
    expect(missing.status).toBe(404);

    await setup.repository.upsertSharedVibeCheck({
      id: crypto.randomUUID(),
      userId: setup.user.id,
      shareToken: 'share-1',
      clicked: false,
      createdAt: setup.deps.clock().toISOString()
    });

    const clicked = await setup.app.request('/v1/vibe-share/share-1/click', { method: 'POST' });
    expect(clicked.status).toBe(200);
    expect(await clicked.json()).toEqual({ clicked: true });
  });

  it('rejects chat operations before unlock', async () => {
    const setup = await buildTestApp();
    const partnerId = crypto.randomUUID();
    const matchId = crypto.randomUUID();

    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'matched',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });

    await setup.repository.upsertMatch({
      id: matchId,
      dropId: 'drop-1',
      userAId: setup.user.id,
      userBId: partnerId,
      status: 'pending_confession',
      synergyPoints: ['One', 'Two'],
      confessionPrompt: 'Prompt',
      responseDeadline: new Date(setup.deps.clock().getTime() + 30 * 60_000).toISOString(),
      expiresAt: new Date(setup.deps.clock().getTime() + 5 * 60 * 60_000).toISOString(),
      version: 0,
      createdAt: setup.deps.clock().toISOString()
    });

    const list = await setup.app.request(`/v1/matches/${matchId}/messages`, {
      headers: { Authorization: 'Bearer token-user' }
    });
    expect(list.status).toBe(422);

    const send = await setup.app.request(`/v1/matches/${matchId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_message_id: 'one', body: 'hello' })
    });
    expect(send.status).toBe(422);
  });

  it('stores match feedback for participants', async () => {
    const setup = await buildTestApp();
    const partnerId = crypto.randomUUID();
    const matchId = crypto.randomUUID();

    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'matched',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });

    await setup.repository.upsertMatch({
      id: matchId,
      dropId: 'drop-1',
      userAId: setup.user.id,
      userBId: partnerId,
      status: 'unlocked',
      synergyPoints: ['One', 'Two'],
      confessionPrompt: 'Prompt',
      responseDeadline: new Date(setup.deps.clock().getTime() + 30 * 60_000).toISOString(),
      expiresAt: new Date(setup.deps.clock().getTime() + 5 * 60 * 60_000).toISOString(),
      version: 2,
      createdAt: setup.deps.clock().toISOString()
    });

    const response = await setup.app.request(`/v1/matches/${matchId}/feedback`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rating: 5 })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
  });

  it('processes ingestion job end-to-end', async () => {
    const setup = await buildTestApp();
    let embeddedInput = '';
    setup.deps.embeddingService.embed = async (input: string) => {
      embeddedInput = input;
      return new Array(1536).fill(0.25);
    };

    const ingestionId = crypto.randomUUID();
    await setup.repository.createProfileIngestion({
      id: ingestionId,
      userId: setup.user.id,
      source: 'chatgpt',
      storageBucket: 'raw-ingestion-staging',
      storageKey: `${setup.user.id}/mem.json`,
      sha256: 'b'.repeat(64),
      sizeBytes: 120,
      status: 'queued',
      piiRiskScore: 0,
      rawMode: 'ttl_object_storage',
      rawDeleteDueAt: new Date(setup.deps.clock().getTime() + 60 * 60_000).toISOString(),
      rawDeleteAttempts: 0,
      policyVersion: 'raw-v1',
      uploadExpiresAt: new Date(setup.deps.clock().getTime() + 10 * 60_000).toISOString(),
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });

    const jobId = crypto.randomUUID();
    await setup.repository.createIngestJob({
      id: jobId,
      ingestionId,
      userId: setup.user.id,
      state: 'queued',
      progress: 0,
      retryable: true,
      pollAfterMs: 2000,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });

    await processIngestionJob(setup.deps, {
      jobId,
      sourceText: 'Contact me at user@example.com. I love deep work and writing.'
    });

    const profile = await setup.repository.getProfileByUserId(setup.user.id);
    expect(profile).not.toBeNull();
    expect(profile?.matchText).toBe('Contact me at [redacted_email]. I love deep work and writing.');
    expect(profile?.sanitizedSummary).toContain('[redacted_email]');
    expect(embeddedInput).toBe(profile?.matchText);

    const job = await setup.repository.getIngestJobById(jobId);
    expect(job?.state).toBe('succeeded');

    const ingestion = await setup.repository.getProfileIngestionById(ingestionId);
    expect(ingestion?.status).toBe('completed');
  });

  it('filters candidate maps by compatibility and historical matches', async () => {
    const setup = await buildTestApp();

    await setup.repository.upsertProfile({
      userId: setup.user.id,
      source: 'chatgpt',
      matchText: 'Systems and writing.',
      sanitizedSummary: 'Systems and writing.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: setup.user.id,
      genderIdentity: 'M',
      attractedTo: ['F'],
      ageMin: 24,
      ageMax: 31
    });

    const compatibleId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: compatibleId,
      email: 'compatible@example.com',
      status: 'waiting',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertProfile({
      userId: compatibleId,
      source: 'claude',
      matchText: 'Music and philosophy.',
      sanitizedSummary: 'Music and philosophy.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0, 0.9),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: compatibleId,
      genderIdentity: 'F',
      attractedTo: ['M'],
      ageMin: 24,
      ageMax: 31
    });

    const incompatibleId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: incompatibleId,
      email: 'incompatible@example.com',
      status: 'waiting',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertProfile({
      userId: incompatibleId,
      source: 'claude',
      matchText: 'Different direction.',
      sanitizedSummary: 'Different direction.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(1),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: incompatibleId,
      genderIdentity: 'NB',
      attractedTo: ['NB'],
      ageMin: 24,
      ageMax: 31
    });

    const previousMatchId = crypto.randomUUID();
    const previousPartnerId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: previousPartnerId,
      email: 'previous@example.com',
      status: 'waiting',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertProfile({
      userId: previousPartnerId,
      source: 'chatgpt',
      matchText: 'Old pair.',
      sanitizedSummary: 'Old pair.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0, 0.8),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: previousPartnerId,
      genderIdentity: 'F',
      attractedTo: ['M'],
      ageMin: 24,
      ageMax: 31
    });
    await setup.repository.upsertMatch({
      id: previousMatchId,
      dropId: 'drop-old',
      userAId: setup.user.id,
      userBId: previousPartnerId,
      status: 'closed',
      synergyPoints: ['One', 'Two'],
      confessionPrompt: 'Prompt',
      responseDeadline: new Date(setup.deps.clock().getTime() - 30 * 60_000).toISOString(),
      expiresAt: new Date(setup.deps.clock().getTime() - 5 * 60 * 60_000).toISOString(),
      version: 2,
      createdAt: setup.deps.clock().toISOString()
    });

    const candidateMap = await setup.repository.buildCandidateMap({ topK: 20 });
    const source = candidateMap.find((item) => item.userId === setup.user.id);

    expect(source?.candidates.map((candidate) => candidate.targetUserId)).toEqual([compatibleId]);
  });

  it('runs internal drop creation with grounded match text', async () => {
    const setup = await buildTestApp();
    const pairInputs: Array<{ profileA: string; profileB: string }> = [];
    setup.deps.llmService.generatePairContent = async (input) => {
      pairInputs.push(input);
      return {
        synergyPoints: ['One', 'Two'],
        confessionPrompt: 'Prompt'
      };
    };

    await setup.repository.upsertProfile({
      userId: setup.user.id,
      source: 'chatgpt',
      matchText: 'I care about writing, systems, and late-night conversations.',
      sanitizedSummary: 'Writing, systems, late-night conversations.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: setup.user.id,
      genderIdentity: 'M',
      attractedTo: ['F'],
      ageMin: 24,
      ageMax: 31
    });

    const partnerId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'waiting',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertProfile({
      userId: partnerId,
      source: 'claude',
      matchText: 'I keep finding myself in philosophy, music, and emotional honesty.',
      sanitizedSummary: 'Philosophy, music, honesty.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0, 0.95),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: partnerId,
      genderIdentity: 'F',
      attractedTo: ['M'],
      ageMin: 24,
      ageMax: 31
    });

    const response = await setup.app.request('/v1/internal/drops/run', {
      method: 'POST',
      headers: {
        'X-Internal-Admin-Token': 'test-admin'
      }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pairs_created: 1,
      status: 'published'
    });
    expect(pairInputs).toHaveLength(1);
    expect([pairInputs[0]?.profileA, pairInputs[0]?.profileB].sort()).toEqual([
      'I care about writing, systems, and late-night conversations.',
      'I keep finding myself in philosophy, music, and emotional honesty.'
    ]);

    const match = await setup.repository.getCurrentMatchByUserId(setup.user.id);
    expect([match?.userAId, match?.userBId].sort()).toEqual([partnerId, setup.user.id].sort());

    const drop = await setup.repository.getRelevantDrop(setup.deps.clock().toISOString());
    expect(drop?.status).toBe('published');
  });

  it('strips redaction artifacts before generating reveal copy', async () => {
    const setup = await buildTestApp();
    const pairInputs: Array<{ profileA: string; profileB: string }> = [];
    setup.deps.llmService.generatePairContent = async (input) => {
      pairInputs.push(input);
      return {
        synergyPoints: ['One', 'Two'],
        confessionPrompt: 'Prompt'
      };
    };

    await setup.repository.upsertProfile({
      userId: setup.user.id,
      source: 'chatgpt',
      matchText:
        'Email me at [redacted_email] and call [redacted_phone]. I care about writing, systems, and slow conversations.',
      sanitizedSummary: 'Writing, systems, and slow conversations.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 25,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: setup.user.id,
      genderIdentity: 'M',
      attractedTo: ['F'],
      ageMin: 24,
      ageMax: 31
    });

    const partnerId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: partnerId,
      email: 'partner@example.com',
      status: 'waiting',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertProfile({
      userId: partnerId,
      source: 'claude',
      matchText: '[redacted_email] [redacted_phone]',
      sanitizedSummary: 'Philosophy, music, and emotional honesty.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(0, 0.95),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 50,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: partnerId,
      genderIdentity: 'F',
      attractedTo: ['M'],
      ageMin: 24,
      ageMax: 31
    });

    const response = await setup.app.request('/v1/internal/drops/run', {
      method: 'POST',
      headers: {
        'X-Internal-Admin-Token': 'test-admin'
      }
    });

    expect(response.status).toBe(200);
    expect(pairInputs).toHaveLength(1);
    expect([pairInputs[0]?.profileA, pairInputs[0]?.profileB].sort()).toEqual([
      'I care about writing, systems, and slow conversations.',
      'Philosophy, music, and emotional honesty.'
    ]);
  });

  it('returns a private invite summary for the viewer', async () => {
    const setup = await buildTestApp();

    const response = await setup.app.request('/v1/referrals/me', {
      headers: { Authorization: 'Bearer token-user' }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      invite_url: expect.stringMatching(/\/\?invite=[A-Z0-9]{8}$/),
      invite_code: expect.stringMatching(/^[A-Z0-9]{8}$/),
      landed_referrals: 0,
      max_landed_referrals: 2,
      available_priority_credits: 0,
      remaining_referral_rewards: 2,
      can_invite: true
    });
  });

  it('claims a valid invite for a new user and rejects self-referral', async () => {
    const setup = await buildTestApp();
    const inviteResponse = await setup.app.request('/v1/referrals/me', {
      headers: { Authorization: 'Bearer token-user' }
    });
    const inviteBody = await inviteResponse.json();
    const inviteCode = inviteBody.invite_code as string;

    const selfClaim = await setup.app.request('/v1/referrals/claim', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ invite_code: inviteCode })
    });
    expect(selfClaim.status).toBe(422);

    const inviteeId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: inviteeId,
      email: 'invitee@example.com',
      status: 'processing',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    setup.auth.seedToken('token-invitee', { id: inviteeId, email: 'invitee@example.com' });

    const claim = await setup.app.request('/v1/referrals/claim', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-invitee',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ invite_code: inviteCode.toLowerCase() })
    });

    expect(claim.status).toBe(200);
    expect(await claim.json()).toEqual({
      claimed: true,
      eligible_for_reward: true,
      reason: null
    });
  });

  it('rate limits referral claims and returns retry-after', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T12:00:00.000Z'));

    const setup = await buildTestApp();
    const inviteResponse = await setup.app.request('/v1/referrals/me', {
      headers: { Authorization: 'Bearer token-user' }
    });
    const inviteCode = (await inviteResponse.json()).invite_code as string;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await setup.app.request('/v1/referrals/claim', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-user',
          'CF-Connecting-IP': '198.51.100.25',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_code: inviteCode })
      });

      expect(response.status).toBe(422);
    }

    const response = await setup.app.request('/v1/referrals/claim', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-user',
        'CF-Connecting-IP': '198.51.100.25',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ invite_code: inviteCode })
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.'
    });
  });

  it('qualifies a claimed referral on first waitlist enroll and grants both credits', async () => {
    const setup = await buildTestApp();
    const inviteResponse = await setup.app.request('/v1/referrals/me', {
      headers: { Authorization: 'Bearer token-user' }
    });
    const inviteCode = (await inviteResponse.json()).invite_code as string;

    const inviteeId = crypto.randomUUID();
    await setup.repository.upsertUser({
      id: inviteeId,
      email: 'invitee@example.com',
      status: 'ready',
      createdAt: setup.deps.clock().toISOString(),
      lastActiveAt: setup.deps.clock().toISOString()
    });
    setup.auth.seedToken('token-invitee', { id: inviteeId, email: 'invitee@example.com' });

    await setup.app.request('/v1/referrals/claim', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-invitee',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ invite_code: inviteCode })
    });

    await setup.repository.upsertProfile({
      userId: inviteeId,
      source: 'chatgpt',
      matchText: 'I like systems, philosophy, and honest conversation.',
      sanitizedSummary: 'I like systems, philosophy, and honest conversation.',
      vibeCheckCard: 'vibe',
      embedding: vectorWithPeak(4),
      embeddingModel: setup.deps.config.embeddingModel,
      piiRiskScore: 0,
      createdAt: setup.deps.clock().toISOString(),
      updatedAt: setup.deps.clock().toISOString()
    });
    await setup.repository.upsertPreferences({
      userId: inviteeId,
      genderIdentity: 'F',
      attractedTo: ['M'],
      ageMin: 24,
      ageMax: 34
    });

    const enroll = await setup.app.request('/v1/waitlist/enroll', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-invitee'
      }
    });

    expect(enroll.status).toBe(200);
    expect(await enroll.json()).toEqual({ enrolled: true, status: 'waiting' });

    const inviterCredits = await setup.repository.countAvailablePriorityCredits(setup.user.id);
    const inviteeCredits = await setup.repository.countAvailablePriorityCredits(inviteeId);
    const rewardedReferral = await setup.repository.getReferralByInviteeUserId(inviteeId);
    const inviteeUser = await setup.repository.getUserById(inviteeId);

    expect(inviterCredits).toBe(1);
    expect(inviteeCredits).toBe(1);
    expect(rewardedReferral?.status).toBe('rewarded');
    expect(inviteeUser?.queueEnteredAt).toBeDefined();
  });

  it('lets a priority-credit user take first pass in matching and consumes only one credit per drop', async () => {
    const setup = await buildTestApp();
    const userAId = setup.user.id;
    const userBId = crypto.randomUUID();
    const userCId = crypto.randomUUID();

    await seedEligibleWaitingUser(setup, {
      userId: userAId,
      email: setup.user.email,
      genderIdentity: 'M',
      attractedTo: ['F'],
      embeddingIndex: 11,
      matchText: 'User A likes essays and systems.'
    });

    await setup.repository.upsertUser({
      ...(await setup.repository.getUserById(userAId))!,
      queueEnteredAt: '2026-03-03T12:00:00.000Z'
    });

    await seedEligibleWaitingUser(setup, {
      userId: userBId,
      email: 'userb@example.com',
      genderIdentity: 'F',
      attractedTo: ['M'],
      embeddingIndex: 11,
      peak: 0.98,
      matchText: 'User B likes essays and systems too.'
    });

    await seedEligibleWaitingUser(setup, {
      userId: userCId,
      email: 'userc@example.com',
      genderIdentity: 'M',
      attractedTo: ['F'],
      embeddingIndex: 11,
      peak: 0.97,
      matchText: 'User C likes essays and systems too.'
    });

    await setup.repository.upsertUser({
      ...(await setup.repository.getUserById(userBId))!,
      queueEnteredAt: '2026-03-03T12:01:00.000Z'
    });
    await setup.repository.upsertUser({
      ...(await setup.repository.getUserById(userCId))!,
      queueEnteredAt: '2026-03-03T12:02:00.000Z'
    });

    const referralIdOne = crypto.randomUUID();
    const referralIdTwo = crypto.randomUUID();
    await setup.repository.createPriorityCredit({
      id: crypto.randomUUID(),
      userId: userCId,
      sourceType: 'referral_invitee',
      referralId: referralIdOne,
      status: 'available',
      availableAt: setup.deps.clock().toISOString(),
      createdAt: setup.deps.clock().toISOString()
    });
    await setup.repository.createPriorityCredit({
      id: crypto.randomUUID(),
      userId: userCId,
      sourceType: 'referral_inviter',
      referralId: referralIdTwo,
      status: 'available',
      availableAt: new Date(setup.deps.clock().getTime() + 1_000).toISOString(),
      createdAt: new Date(setup.deps.clock().getTime() + 1_000).toISOString()
    });

    const response = await setup.app.request('/v1/internal/drops/run', {
      method: 'POST',
      headers: {
        'X-Internal-Admin-Token': 'test-admin'
      }
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.status).toBe('published');

    const match = [...setup.repository.matches.values()].find((item) => item.dropId === responseBody.drop_id);
    expect([match?.userAId, match?.userBId].sort()).toEqual([userBId, userCId].sort());

    expect(await setup.repository.countAvailablePriorityCredits(userCId)).toBe(1);

    const consumedAgain = await setup.repository.consumePriorityCreditsForDrop(responseBody.drop_id as string, setup.deps.clock().toISOString());
    expect(consumedAgain).toEqual([]);
    expect(await setup.repository.countAvailablePriorityCredits(userCId)).toBe(1);
  });

  it('preserves priority credits when a drop fails', async () => {
    const setup = await buildTestApp();
    await setup.repository.createPriorityCredit({
      id: crypto.randomUUID(),
      userId: setup.user.id,
      sourceType: 'referral_invitee',
      referralId: crypto.randomUUID(),
      status: 'available',
      availableAt: setup.deps.clock().toISOString(),
      createdAt: setup.deps.clock().toISOString()
    });

    const response = await setup.app.request('/v1/internal/drops/run', {
      method: 'POST',
      headers: {
        'X-Internal-Admin-Token': 'test-admin'
      }
    });

    expect(response.status).toBe(422);
    expect(await setup.repository.countAvailablePriorityCredits(setup.user.id)).toBe(1);
  });
});
