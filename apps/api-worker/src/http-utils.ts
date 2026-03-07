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
