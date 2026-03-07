export type Candidate = {
  targetUserId: string;
  score: number;
};

export type UserCandidates = {
  userId: string;
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

  const users = [...map.keys()].sort();
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
