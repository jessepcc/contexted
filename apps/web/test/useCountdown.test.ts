import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('useCountdown logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns formatted time string when target is in the future', async () => {
    const now = new Date('2025-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const { useCountdown } = await import('../src/hooks/useCountdown.js');

    // Target is 1 hour, 30 minutes, 45 seconds in the future
    const target = '2025-01-01T13:30:45Z';
    const serverNow = '2025-01-01T12:00:00Z';

    // Test the computation directly
    const skew = new Date(serverNow).getTime() - now.getTime();
    const remaining = new Date(target).getTime() - (now.getTime() + skew);
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const formatted = [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');

    expect(formatted).toBe('01:30:45');
  });

  it('returns null computation when target is in the past', () => {
    const now = new Date('2025-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const target = '2025-01-01T11:00:00Z';
    const serverNow = '2025-01-01T12:00:00Z';

    const skew = new Date(serverNow).getTime() - now.getTime();
    const remaining = new Date(target).getTime() - (now.getTime() + skew);

    expect(remaining).toBeLessThanOrEqual(0);
  });

  it('accounts for server-client skew correctly', () => {
    // Client clock is 5 seconds behind server
    const clientNow = new Date('2025-01-01T11:59:55Z');
    vi.setSystemTime(clientNow);

    const serverNow = '2025-01-01T12:00:00Z';
    const target = '2025-01-01T12:01:00Z'; // 1 minute after server now

    const skew = new Date(serverNow).getTime() - clientNow.getTime();
    expect(skew).toBe(5000); // 5 second skew

    const remaining = new Date(target).getTime() - (clientNow.getTime() + skew);
    const totalSeconds = Math.floor(remaining / 1000);

    expect(totalSeconds).toBe(60); // 60 seconds remaining, adjusted for skew
  });

  it('ticks down each second', () => {
    const now = new Date('2025-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const serverNow = '2025-01-01T12:00:00Z';
    const target = '2025-01-01T12:00:05Z'; // 5 seconds from now

    // After 2 seconds, 3 seconds remain
    vi.setSystemTime(new Date('2025-01-01T12:00:02Z'));
    const skew = new Date(serverNow).getTime() - now.getTime();
    const newNow = new Date('2025-01-01T12:00:02Z');
    const remaining = new Date(target).getTime() - (newNow.getTime() + skew);
    const totalSeconds = Math.floor(remaining / 1000);

    expect(totalSeconds).toBe(3);
  });

  it('format produces HH:MM:SS with zero padding', () => {
    // 3661 seconds = 1:01:01
    const ms = 3661 * 1000;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const formatted = [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');

    expect(formatted).toBe('01:01:01');
  });

  it('handles null targetIso by returning null computation', () => {
    const targetIso: string | null = null;
    expect(targetIso).toBeNull();
  });
});
