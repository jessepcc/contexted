import { buildDeterministicPairs, type UserCandidates } from '@contexted/shared';
import type { AppDependencies } from '../dependencies.js';

export type DropPairInput = {
  dropId: string;
  candidateMap: UserCandidates[];
};

export async function materializeDropPairs(deps: AppDependencies, input: DropPairInput): Promise<number> {
  const pairs = buildDeterministicPairs(input.candidateMap);

  for (const pair of pairs) {
    const now = deps.clock();
    const unlockDeadline = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const pairContent = await deps.llmService.generatePairContent({
      profileA: pair.userAId,
      profileB: pair.userBId
    });

    await deps.repository.upsertMatch({
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
  }

  return pairs.length;
}
