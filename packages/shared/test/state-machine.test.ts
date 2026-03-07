import { describe, expect, it } from 'vitest';
import { derivePhase } from '../src/state-machine.js';

describe('derivePhase', () => {
  const now = '2026-03-03T12:00:00.000Z';

  it('returns processing when ingestion is in flight', () => {
    expect(
      derivePhase(
        {
          userStatus: 'processing',
          ingestionState: 'processing'
        },
        now
      )
    ).toBe('processing');
  });

  it('returns matched_locked for pending confession', () => {
    expect(
      derivePhase(
        {
          userStatus: 'matched',
          matchStatus: 'pending_confession'
        },
        now
      )
    ).toBe('matched_locked');
  });

  it('returns expired when chat is unlocked but expired', () => {
    expect(
      derivePhase(
        {
          userStatus: 'matched',
          matchStatus: 'unlocked',
          chatExpiresAt: '2026-03-03T11:59:59.000Z'
        },
        now
      )
    ).toBe('expired');
  });

  it('returns waiting for ready users', () => {
    expect(
      derivePhase(
        {
          userStatus: 'ready'
        },
        now
      )
    ).toBe('waiting');
  });
});
