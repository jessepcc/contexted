export type Candidate = {
  targetUserId: string;
  score: number;
};

export type UserCandidates = {
  userId: string;
  priorityTier?: number;
  queueEnteredAt?: string;
  candidates: Candidate[];
};

export type MatchPair = {
  userAId: string;
  userBId: string;
  score: number;
};

function normalizePair(userAId: string, userBId: string, score: number): MatchPair {
  return userAId < userBId
    ? { userAId, userBId, score }
    : { userAId: userBId, userBId: userAId, score };
}

export function buildDeterministicPairs(candidateMap: UserCandidates[]): MatchPair[] {
  const map = new Map<string, Candidate[]>();

  for (const item of candidateMap) {
    const sorted = [...item.candidates]
      .filter((candidate) => candidate.targetUserId !== item.userId)
      .sort((left, right) => right.score - left.score || left.targetUserId.localeCompare(right.targetUserId));
    map.set(item.userId, sorted);
  }

  const priorityByUser = new Map(
    candidateMap.map((item) => [
      item.userId,
      {
        priorityTier: item.priorityTier ?? 0,
        queueEnteredAt: item.queueEnteredAt ?? ''
      }
    ])
  );

  const users = [...map.keys()].sort((left, right) => {
    const leftMeta = priorityByUser.get(left) ?? { priorityTier: 0, queueEnteredAt: '' };
    const rightMeta = priorityByUser.get(right) ?? { priorityTier: 0, queueEnteredAt: '' };

    if (rightMeta.priorityTier !== leftMeta.priorityTier) {
      return rightMeta.priorityTier - leftMeta.priorityTier;
    }

    const leftQueue = leftMeta.queueEnteredAt;
    const rightQueue = rightMeta.queueEnteredAt;
    if (leftQueue !== rightQueue) {
      if (!leftQueue) return 1;
      if (!rightQueue) return -1;
      return leftQueue.localeCompare(rightQueue);
    }

    return left.localeCompare(right);
  });
  const used = new Set<string>();
  const pairs: MatchPair[] = [];
  const seenPairs = new Set<string>();

  for (const userId of users) {
    if (used.has(userId)) {
      continue;
    }

    const candidates = map.get(userId) ?? [];
    const candidate = candidates.find((entry) => !used.has(entry.targetUserId));
    if (!candidate) {
      continue;
    }

    const otherId = candidate.targetUserId;
    const pairKey = [userId, otherId].sort().join(':');
    if (seenPairs.has(pairKey)) {
      continue;
    }

    used.add(userId);
    used.add(otherId);
    seenPairs.add(pairKey);
    pairs.push(normalizePair(userId, otherId, candidate.score));
  }

  return pairs.sort((left, right) => right.score - left.score || left.userAId.localeCompare(right.userAId));
}
