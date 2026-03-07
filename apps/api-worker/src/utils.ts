import { createHash } from 'node:crypto';
import type { MatchRecord } from './model.js';

export function hashRevealToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getPollAfterMs(isBackground: boolean, foregroundSec: number, backgroundSec: number): number {
  return (isBackground ? backgroundSec : foregroundSec) * 1000;
}

export function isMatchParticipant(match: MatchRecord, userId: string): boolean {
  return match.userAId === userId || match.userBId === userId;
}

export function getConfessionVersionConflict(currentVersion: number, expectedVersion: number): boolean {
  return currentVersion !== expectedVersion;
}

export function computeMessageEtag(matchId: string, messages: Array<{ id: string; createdAt: string }>): string {
  const tail = messages.at(-1);
  const marker = tail ? `${tail.id}:${tail.createdAt}` : 'empty';
  return `"${matchId}:${messages.length}:${marker}"`;
}
