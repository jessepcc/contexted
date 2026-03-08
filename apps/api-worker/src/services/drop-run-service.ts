import type { AppDependencies } from '../dependencies.js';
import { materializeDropPairs } from './drop-service.js';

export type RunDropInput = {
  dropId?: string;
  mode?: string;
};

export type RunDropResult = {
  dropId: string;
  pairsCreated: number;
  poolSize: number;
  status: 'published' | 'failed';
  failureReason?: string;
};

function trimFailureReason(reason: string): string {
  return reason.slice(0, 200);
}

export async function runDrop(deps: AppDependencies, input: RunDropInput = {}): Promise<RunDropResult> {
  const startedAt = deps.clock().toISOString();
  const dropId = input.dropId ?? crypto.randomUUID();
  const mode = input.mode ?? 'global';

  await deps.repository.upsertDrop({
    id: dropId,
    scheduledAt: startedAt,
    status: 'matching',
    mode,
    poolSize: 0,
    startedAt,
    createdAt: startedAt
  });

  try {
    const candidateMap = await deps.repository.buildCandidateMap({
      topK: deps.config.matchTopK
    });
    const poolSize = candidateMap.length;

    console.info('[drop] matching pool built', {
      dropId,
      poolSize,
      topK: deps.config.matchTopK
    });

    if (poolSize < 2) {
      const failureReason = 'INSUFFICIENT_ELIGIBLE_USERS';
      await deps.repository.upsertDrop({
        id: dropId,
        scheduledAt: startedAt,
        status: 'failed',
        mode,
        poolSize,
        failureReason,
        startedAt,
        finishedAt: deps.clock().toISOString(),
        createdAt: startedAt
      });

      return {
        dropId,
        pairsCreated: 0,
        poolSize,
        status: 'failed',
        failureReason
      };
    }

    const materialized = await materializeDropPairs(deps, {
      dropId,
      candidateMap
    });

    if (materialized.pairsCreated === 0) {
      const failureReason = 'NO_ELIGIBLE_PAIRS';
      await deps.repository.upsertDrop({
        id: dropId,
        scheduledAt: startedAt,
        status: 'failed',
        mode,
        poolSize,
        failureReason,
        startedAt,
        finishedAt: deps.clock().toISOString(),
        createdAt: startedAt
      });

      return {
        dropId,
        pairsCreated: 0,
        poolSize,
        status: 'failed',
        failureReason
      };
    }

    await deps.repository.upsertDrop({
      id: dropId,
      scheduledAt: startedAt,
      status: 'content_ready',
      mode,
      poolSize,
      startedAt,
      createdAt: startedAt
    });

    for (const userId of materialized.matchedUserIds) {
      await deps.repository.setUserStatus(userId, 'matched');
    }

    await deps.repository.upsertDrop({
      id: dropId,
      scheduledAt: startedAt,
      status: 'published',
      mode,
      poolSize,
      startedAt,
      finishedAt: deps.clock().toISOString(),
      createdAt: startedAt
    });

    console.info('[drop] published', {
      dropId,
      poolSize,
      pairCount: materialized.pairsCreated
    });

    return {
      dropId,
      pairsCreated: materialized.pairsCreated,
      poolSize,
      status: 'published'
    };
  } catch (error) {
    const failureReason = trimFailureReason(error instanceof Error ? error.message : 'DROP_RUN_FAILED');
    await deps.repository.upsertDrop({
      id: dropId,
      scheduledAt: startedAt,
      status: 'failed',
      mode,
      failureReason,
      startedAt,
      finishedAt: deps.clock().toISOString(),
      createdAt: startedAt
    });

    console.error('[drop] failed', {
      dropId,
      failureReason
    });

    throw error;
  }
}
