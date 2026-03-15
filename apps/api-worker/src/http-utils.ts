import { ApiValidationError, type ApiErrorPayload } from '@contexted/shared';
import type { Context, Next } from 'hono';
import { ZodError, type ZodType } from 'zod';
import type { AppDependencies, AuthenticatedUser } from './dependencies.js';

export type AppEnv = {
  Variables: {
    viewer: AuthenticatedUser;
  };
};

export function jsonError(c: Context, payload: ApiErrorPayload, status = 422): Response {
  return c.json(payload, status as any);
}

function mapZodError(error: ZodError): ApiErrorPayload {
  const issue = error.issues[0];
  const field = issue?.path?.join('.') || undefined;
  const message = issue?.message ?? 'Invalid input.';

  let code: ApiErrorPayload['code'] = 'INVALID_FORMAT';
  if (message.includes('at most') || message.includes('at least') || message.includes('greater than')) {
    code = 'OUT_OF_RANGE';
  }

  if (message.includes('invalid enum') || message.includes('cannot include')) {
    code = 'DISALLOWED_VALUE';
  }

  return {
    code,
    field,
    message
  };
}

export async function parseValidatedJson<T>(
  c: Context,
  schema: ZodType<T>,
  deps: AppDependencies
): Promise<T> {
  const rawText = await c.req.text();
  if (rawText.length === 0) {
    throw new ApiValidationError({
      code: 'INVALID_FORMAT',
      message: 'Request body is required.'
    });
  }

  const bytes = new TextEncoder().encode(rawText).byteLength;
  if (bytes > deps.config.maxJsonBodyBytes) {
    throw new ApiValidationError({
      code: 'PAYLOAD_TOO_LARGE',
      message: `Payload exceeds ${deps.config.maxJsonBodyBytes} bytes.`
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ApiValidationError({
      code: 'INVALID_FORMAT',
      message: 'Malformed JSON body.'
    });
  }

  try {
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiValidationError(mapZodError(error));
    }
    throw error;
  }
}

export function bearerToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function requireIdempotencyKey(c: Context): string {
  const key = c.req.header('Idempotency-Key');
  if (!key || key.trim().length === 0 || key.length > 255) {
    throw new ApiValidationError({
      code: 'INVALID_FORMAT',
      field: 'Idempotency-Key',
      message: 'Idempotency-Key header is required.'
    });
  }

  return key.trim();
}

export function createAuthMiddleware(deps: AppDependencies) {
  return async (c: Context<AppEnv>, next: Next): Promise<void | Response> => {
    const token = bearerToken(c);
    if (!token) {
      return c.json({ code: 'INVALID_FORMAT', field: 'Authorization', message: 'Missing bearer token.' }, 401);
    }

    const viewer = await deps.authService.authenticateToken(token);
    if (!viewer) {
      return c.json({ code: 'INVALID_FORMAT', field: 'Authorization', message: 'Invalid or expired token.' }, 401);
    }

    c.set('viewer', viewer);
    await next();
  };
}

type RateLimiterStore = {
  hits: Map<string, number[]>;
  lastCleanupAt: number;
};

const rateLimiterStores = new Map<string, RateLimiterStore>();

function getRateLimiterStore(name: string): RateLimiterStore {
  let store = rateLimiterStores.get(name);
  if (!store) {
    store = {
      hits: new Map<string, number[]>(),
      lastCleanupAt: 0
    };
    rateLimiterStores.set(name, store);
  }

  return store;
}

function cleanupExpiredHits(store: RateLimiterStore, cutoff: number): void {
  for (const [key, timestamps] of store.hits) {
    const filtered = timestamps.filter((timestamp) => timestamp > cutoff);
    if (filtered.length === 0) {
      store.hits.delete(key);
      continue;
    }

    store.hits.set(key, filtered);
  }
}

function getRateLimitKey(c: Context): string {
  const cloudflareIp = c.req.header('cf-connecting-ip')?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const trueClientIp = c.req.header('true-client-ip')?.trim();
  if (trueClientIp) {
    return trueClientIp;
  }

  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || 'unknown';
}

/**
 * In-memory sliding window rate limiter keyed by client IP.
 * State is module-scoped so it survives app recreation within a single isolate.
 */
export function createRateLimiter(opts: { name: string; windowMs: number; maxRequests: number }) {
  const store = getRateLimiterStore(opts.name);

  return async (c: Context, next: Next): Promise<void | Response> => {
    const key = getRateLimitKey(c);
    const now = Date.now();
    const cutoff = now - opts.windowMs;

    if (now - store.lastCleanupAt >= opts.windowMs) {
      cleanupExpiredHits(store, cutoff);
      store.lastCleanupAt = now;
    }

    const timestamps = (store.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (timestamps.length >= opts.maxRequests) {
      const retryAfter = Math.ceil((timestamps[0]! + opts.windowMs - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
        429 as any
      );
    }

    timestamps.push(now);
    store.hits.set(key, timestamps);
    await next();
  };
}

export function resetRateLimitersForTests(): void {
  rateLimiterStores.clear();
}

export function withAppErrors(handler: (c: Context) => Promise<Response>): (c: Context) => Promise<Response> {
  return async (c: Context): Promise<Response> => {
    try {
      return await handler(c);
    } catch (error) {
      if (error instanceof ApiValidationError) {
      return c.json(error.payload, error.statusCode as any);
    }

      return c.json(
        {
          code: 'STATE_CONFLICT',
          message: error instanceof Error ? error.message : 'Unexpected server error.'
        },
        500
      );
    }
  };
}
