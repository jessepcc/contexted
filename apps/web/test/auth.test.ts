import { afterEach, describe, expect, it } from 'vitest';
import { getViewerIdFromToken } from '../src/auth.js';

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('getViewerIdFromToken', () => {
  afterEach(() => {
    localStorage.removeItem('contexted_token');
  });

  it('returns sub from a valid JWT', () => {
    localStorage.setItem('contexted_token', fakeJwt({ sub: 'user-123' }));
    expect(getViewerIdFromToken()).toBe('user-123');
  });

  it('returns null when token is missing', () => {
    expect(getViewerIdFromToken()).toBeNull();
  });

  it('returns null for an invalid token', () => {
    localStorage.setItem('contexted_token', 'not-a-jwt');
    expect(getViewerIdFromToken()).toBeNull();
  });

  it('returns null when payload has no sub', () => {
    localStorage.setItem('contexted_token', fakeJwt({ name: 'test' }));
    expect(getViewerIdFromToken()).toBeNull();
  });
});
