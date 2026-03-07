import { describe, expect, it } from 'vitest';
import type { BootstrapDrop } from '../src/types.js';
import { getWaitingRoomContent } from '../src/waitingRoom.js';

function buildDrop(overrides: Partial<BootstrapDrop>): BootstrapDrop {
  return {
    id: 'drop-1',
    status: 'scheduled',
    scheduled_at: '2026-03-10T18:00:00.000Z',
    mode: 'global',
    pool_size: null,
    failure_reason: null,
    started_at: null,
    finished_at: null,
    ...overrides
  };
}

describe('getWaitingRoomContent', () => {
  it('returns an honest fallback when no drop exists', () => {
    const content = getWaitingRoomContent(null);

    expect(content.statusLabel).toBe('No drop scheduled');
    expect(content.title).toContain('waiting room');
    expect(content.facts).toHaveLength(3);
  });

  it('uses live matching copy when a drop is matching', () => {
    const content = getWaitingRoomContent(
      buildDrop({
        status: 'matching',
        pool_size: 42
      })
    );

    expect(content.statusLabel).toBe('Matching live');
    expect(content.title).toContain('pairing');
    expect(content.pills[0]).toContain('42');
  });

  it('includes the failure reason for failed drops', () => {
    const content = getWaitingRoomContent(
      buildDrop({
        status: 'failed',
        failure_reason: 'Embedding queue backed up'
      })
    );

    expect(content.statusBody).toContain('Embedding queue backed up');
    expect(content.body).toContain('Embedding queue backed up');
  });
});
