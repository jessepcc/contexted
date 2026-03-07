export type ApiError = {
  code: string;
  field?: string;
  message: string;
};

export class HttpError extends Error {
  public readonly status: number;
  public readonly payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.message);
    this.status = status;
    this.payload = payload;
  }
}

function authHeader(): HeadersInit {
  const token = localStorage.getItem('contexted_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequestRaw(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok && response.status !== 304) {
    if (response.status === 401) {
      localStorage.removeItem('contexted_token');
      window.dispatchEvent(new CustomEvent('contexted:unauthorized'));
    }
    const error = (await response.json().catch(() => ({ code: 'STATE_CONFLICT', message: 'Request failed.' }))) as ApiError;
    throw new HttpError(response.status, error);
  }
  return response;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 304) {
    return undefined as T;
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('contexted_token');
      window.dispatchEvent(new CustomEvent('contexted:unauthorized'));
    }
    const error = (await response.json().catch(() => ({ code: 'STATE_CONFLICT', message: 'Request failed.' }))) as ApiError;
    throw new HttpError(response.status, error);
  }

  return (await response.json()) as T;
}
