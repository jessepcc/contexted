import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createInMemoryDependencies } from '../src/factories.js';
import { processIngestionJob } from '../src/services/ingestion-service.js';
import { hashRevealToken } from '../src/utils.js';

async function buildTestApp() {
  const factory = createInMemoryDependencies();
  let now = new Date('2026-03-03T12:00:00.000Z');
  factory.deps.clock = () => new Date(now);

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

describe('api worker', () => {
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
    expect(await response.json()).toEqual({ sent: true });

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
    expect(setup.queue.enqueued[0]?.payload.sourceText).toContain('Provider: Gemini');
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

  it('serves reveal artifacts and respects token expiry', async () => {
    const setup = await buildTestApp();
    const matchId = crypto.randomUUID();
    const token = 'reveal-token';
    const tokenHash = hashRevealToken(token);
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
      tokenHash: hashRevealToken('expired-token'),
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
    expect(profile?.sanitizedSummary).toContain('[redacted_email]');

    const job = await setup.repository.getIngestJobById(jobId);
    expect(job?.state).toBe('succeeded');

    const ingestion = await setup.repository.getProfileIngestionById(ingestionId);
    expect(ingestion?.status).toBe('completed');
  });
});
