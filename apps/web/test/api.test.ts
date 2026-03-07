import { describe, expect, it, vi } from 'vitest';
import { apiRequest, apiRequestRaw, HttpError } from '../src/api.js';

describe('apiRequest', () => {
  it('throws HttpError for non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'STATE_CONFLICT', message: 'boom' }), {
          status: 422,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    await expect(apiRequest('/v1/test', { method: 'POST' })).rejects.toBeInstanceOf(HttpError);
  });

  it('returns parsed json for successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    const result = await apiRequest<{ ok: boolean }>('/v1/test');
    expect(result.ok).toBe(true);
  });
});

describe('apiRequestRaw', () => {
  it('returns raw Response for 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json', etag: '"abc"' }
        })
      )
    );

    const response = await apiRequestRaw('/v1/test');
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"abc"');
    const body = await response.json();
    expect(body).toEqual({ items: [] });
  });

  it('returns raw Response for 304 without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(null, { status: 304 })
      )
    );

    const response = await apiRequestRaw('/v1/test');
    expect(response.status).toBe(304);
  });

  it('throws HttpError for non-2xx non-304 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    await expect(apiRequestRaw('/v1/test')).rejects.toBeInstanceOf(HttpError);
  });
});
