import type { MatchRecord } from './model.js';

export async function hashRevealToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
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
