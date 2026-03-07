import type { AppPhase, MatchStatus, UserStatus } from './enums.js';

export type BootstrapState = {
  userStatus: UserStatus;
  ingestionState?: 'pending' | 'processing' | 'completed' | 'failed';
  matchStatus?: MatchStatus;
  chatExpiresAt?: string;
};

export function derivePhase(input: BootstrapState, nowIso: string): AppPhase {
  const now = new Date(nowIso).getTime();

  if (input.ingestionState === 'pending' || input.ingestionState === 'processing') {
    return 'processing';
  }

  if (input.matchStatus === 'pending_confession') {
    return 'matched_locked';
  }

  if (input.matchStatus === 'unlocked') {
    if (input.chatExpiresAt && new Date(input.chatExpiresAt).getTime() <= now) {
      return 'expired';
    }
    return 'chat_unlocked';
  }

  if (input.matchStatus === 'expired' || input.userStatus === 'failed') {
    return 'expired';
  }

  if (input.userStatus === 'waiting' || input.userStatus === 'ready' || input.userStatus === 'matched') {
    return 'waiting';
  }

  return 'upload';
}
