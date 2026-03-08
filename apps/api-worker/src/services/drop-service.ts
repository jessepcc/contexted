import { buildDeterministicPairs, stripRedactionArtifacts, type UserCandidates } from '@contexted/shared';
import type { AppDependencies } from '../dependencies.js';
import type { ProfileRecord } from '../model.js';

export type DropPairInput = {
  dropId: string;
  candidateMap: UserCandidates[];
};

function toPairPromptProfile(profile: ProfileRecord): string {
  const cleanedMatchText = stripRedactionArtifacts(profile.matchText);
  if (cleanedMatchText.length > 0) {
    return cleanedMatchText;
  }

  const cleanedSummary = stripRedactionArtifacts(profile.sanitizedSummary);
  if (cleanedSummary.length > 0) {
    return cleanedSummary;
  }

  return profile.sanitizedSummary.trim();
}

export async function materializeDropPairs(
  deps: AppDependencies,
  input: DropPairInput
): Promise<{ pairsCreated: number; matchedUserIds: string[] }> {
  const pairs = buildDeterministicPairs(input.candidateMap);
  if (pairs.length === 0) {
    return {
      pairsCreated: 0,
      matchedUserIds: []
    };
  }

  const profileUserIds = [...new Set(pairs.flatMap((pair) => [pair.userAId, pair.userBId]))];
  const profiles = await deps.repository.getProfilesByUserIds(profileUserIds);
  const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const matchedUserIds = new Set<string>();
  const matchesToCreate: Array<{
    id: string;
    dropId: string;
    userAId: string;
    userBId: string;
    status: 'pending_confession';
    synergyPoints: [string, string];
    confessionPrompt: string;
    responseDeadline: string;
    expiresAt: string;
    version: number;
    createdAt: string;
  }> = [];

  for (const pair of pairs) {
    const now = deps.clock();
    const unlockDeadline = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const profileA = profilesByUserId.get(pair.userAId);
    const profileB = profilesByUserId.get(pair.userBId);
    if (!profileA || !profileB) {
      throw new Error(`Profile data missing for pair ${pair.userAId}:${pair.userBId}.`);
    }

    const pairContent = await deps.llmService.generatePairContent({
      profileA: toPairPromptProfile(profileA),
      profileB: toPairPromptProfile(profileB)
    });

    matchesToCreate.push({
      id: crypto.randomUUID(),
      dropId: input.dropId,
      userAId: pair.userAId,
      userBId: pair.userBId,
      status: 'pending_confession',
      synergyPoints: pairContent.synergyPoints,
      confessionPrompt: pairContent.confessionPrompt,
      responseDeadline: unlockDeadline,
      expiresAt,
      version: 0,
      createdAt: now.toISOString()
    });

    matchedUserIds.add(pair.userAId);
    matchedUserIds.add(pair.userBId);
  }

  for (const match of matchesToCreate) {
    await deps.repository.upsertMatch(match);
  }

  return {
    pairsCreated: matchesToCreate.length,
    matchedUserIds: [...matchedUserIds]
  };
}
