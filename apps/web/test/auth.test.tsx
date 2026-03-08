import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest } from '../src/api.js';
import { parseHashToken, parseInviteFromSearch } from '../src/pages/VerifyPage.js';
import { buildMagicLinkRedirect } from '../src/referrals.js';

describe('LoginPage API call', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct POST body for magic-link request', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await apiRequest<{ sent: boolean }>('/v1/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        redirect_to: 'http://localhost:5173/auth/verify'
      })
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/v1/auth/magic-link');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body.email).toBe('user@example.com');
    expect(body.redirect_to).toBe('http://localhost:5173/auth/verify');
  });

  it('includes Content-Type header in magic-link request', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await apiRequest<{ sent: boolean }>('/v1/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', redirect_to: 'http://localhost/auth/verify' })
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('builds a magic link redirect that preserves a pending invite code', () => {
    localStorage.setItem('contexted_pending_invite_code', 'quiet-link');
    expect(buildMagicLinkRedirect('http://localhost:5173')).toBe('http://localhost:5173/auth/verify?invite=quiet-link');
  });
});

describe('VerifyPage hash parsing', () => {
  it('extracts access_token from hash fragment', () => {
    const hash = '#access_token=abc123&token_type=bearer&expires_in=3600';
    expect(parseHashToken(hash)).toBe('abc123');
  });

  it('returns null when no access_token in hash', () => {
    expect(parseHashToken('#token_type=bearer')).toBeNull();
  });

  it('returns null for empty hash', () => {
    expect(parseHashToken('')).toBeNull();
  });

  it('handles hash without leading #', () => {
    const hash = 'access_token=xyz789&token_type=bearer';
    expect(parseHashToken(hash)).toBe('xyz789');
  });

  it('extracts invite code from search params', () => {
    expect(parseInviteFromSearch('?invite=quiet-link')).toBe('quiet-link');
    expect(parseInviteFromSearch('?invite=bad code')).toBeNull();
  });
});

describe('VerifyPage token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores token in localStorage under contexted_token', () => {
    const token = 'test-token-12345';
    localStorage.setItem('contexted_token', token);
    expect(localStorage.getItem('contexted_token')).toBe(token);
  });
});
