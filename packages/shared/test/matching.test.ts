import { describe, expect, it } from 'vitest';
import { buildDeterministicPairs } from '../src/matching.js';

describe('buildDeterministicPairs', () => {
  it('pairs users deterministically and avoids duplicates', () => {
    const pairs = buildDeterministicPairs([
      {
        userId: 'u1',
        candidates: [
          { targetUserId: 'u2', score: 0.9 },
          { targetUserId: 'u3', score: 0.5 }
        ]
      },
      {
        userId: 'u2',
        candidates: [{ targetUserId: 'u1', score: 0.8 }]
      },
      {
        userId: 'u3',
        candidates: [{ targetUserId: 'u1', score: 0.7 }]
      }
    ]);

    expect(pairs).toEqual([{ userAId: 'u1', userBId: 'u2', score: 0.9 }]);
  });

  it('skips self and already used candidates', () => {
    const pairs = buildDeterministicPairs([
      {
        userId: 'u1',
        candidates: [
          { targetUserId: 'u1', score: 1 },
          { targetUserId: 'u2', score: 0.9 }
        ]
      },
      {
        userId: 'u2',
        candidates: [{ targetUserId: 'u3', score: 0.6 }]
      },
      {
        userId: 'u3',
        candidates: [{ targetUserId: 'u2', score: 0.8 }]
      }
    ]);

    expect(pairs).toEqual([{ userAId: 'u1', userBId: 'u2', score: 0.9 }]);
  });
});
