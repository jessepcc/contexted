import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiValidationError } from '@contexted/shared';
import type {
  AuthService,
  EmbeddingService,
  LlmService,
  QueueService,
  StorageService
} from './dependencies.js';

export class SupabaseAuthService implements AuthService {
  private readonly client: SupabaseClient;

  constructor(input: { supabaseUrl: string; supabaseAnonKey: string }) {
    this.client = createClient(input.supabaseUrl, input.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  async sendMagicLink(input: { email: string; redirectTo: string; userId?: string }): Promise<{ devVerifyUrl?: string }> {
    const response = await this.client.auth.signInWithOtp({
      email: input.email,
      options: {
        emailRedirectTo: input.redirectTo
      }
    });

    if (response.error) {
      if (response.error.status === 429) {
        throw new ApiValidationError(
          { code: 'STATE_CONFLICT', message: 'email rate limit exceeded' },
          429
        );
      }
      throw new Error(`Failed to send magic link: ${response.error.message}`);
    }

    return {};
  }

  async authenticateToken(token: string): Promise<{ id: string; email: string } | null> {
    const response = await this.client.auth.getUser(token);
    if (response.error || !response.data.user?.email) {
      return null;
    }

    return {
      id: response.data.user.id,
      email: response.data.user.email
    };
  }
}

export class InMemoryAuthService implements AuthService {
  private readonly usersByToken = new Map<string, { id: string; email: string }>();

  private buildDevJwt(sub: string, email: string): string {
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub, email })).toString('base64url');
    return `${header}.${payload}.dev`;
  }

  seedToken(token: string, user: { id: string; email: string }): void {
    this.usersByToken.set(token, user);
  }

  async sendMagicLink(input: { email: string; redirectTo: string; userId?: string }): Promise<{ devVerifyUrl?: string }> {
    if (!input.userId) {
      return {};
    }

    const token = this.buildDevJwt(input.userId, input.email);
    this.seedToken(token, {
      id: input.userId,
      email: input.email
    });

    const url = new URL(input.redirectTo);
    url.hash = new URLSearchParams({
      access_token: token,
      token_type: 'bearer'
    }).toString();

    return {
      devVerifyUrl: url.toString()
    };
  }

  async authenticateToken(token: string): Promise<{ id: string; email: string } | null> {
    return this.usersByToken.get(token) ?? null;
  }
}

export class InMemoryStorageService implements StorageService {
  private readonly artifacts = new Map<string, unknown>();
  private readonly uploads = new Map<string, { userId: string; source: string; fileName: string }>();
  private readonly baseUrl: string;

  constructor(opts?: { baseUrl?: string }) {
    this.baseUrl = opts?.baseUrl ?? 'https://storage.contexted.local';
  }

  seedArtifact(path: string, payload: unknown): void {
    this.artifacts.set(path, payload);
  }

  async createSignedUpload(input: {
    userId: string;
    source: string;
    fileName: string;
    expiresInSeconds: number;
    maxBytes: number;
  }): Promise<{
    uploadUrl: string;
    uploadHeaders: Record<string, string>;
    expiresAt: string;
    maxBytes: number;
    storageBucket: string;
    storageKey: string;
  }> {
    const key = `${input.userId}/${crypto.randomUUID()}-${input.fileName}`;
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
    this.uploads.set(key, { userId: input.userId, source: input.source, fileName: input.fileName });

    return {
      uploadUrl: `${this.baseUrl}/r/upload-sink/${key}`,
      uploadHeaders: {
        'x-upload-source': input.source,
        'x-upload-user': input.userId
      },
      expiresAt,
      maxBytes: input.maxBytes,
      storageBucket: 'raw-ingestion-staging',
      storageKey: key
    };
  }

  async readArtifact(path: string): Promise<unknown> {
    if (!this.artifacts.has(path)) {
      throw new Error('Artifact not found.');
    }

    return this.artifacts.get(path);
  }
}

export class InMemoryQueueService implements QueueService {
  public readonly enqueued: Array<{ topic: 'ingest' | 'drop'; payload: Record<string, string> }> = [];
  public onEnqueue?: (topic: 'ingest' | 'drop', payload: Record<string, string>) => void;

  async enqueue(topic: 'ingest' | 'drop', payload: Record<string, string>): Promise<void> {
    this.enqueued.push({ topic, payload });
    this.onEnqueue?.(topic, payload);
  }
}

export class SupabaseStorageService implements StorageService {
  private readonly client: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly bucket: string;

  constructor(input: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    bucket: string;
  }) {
    this.supabaseUrl = input.supabaseUrl;
    this.bucket = input.bucket;
    this.client = createClient(input.supabaseUrl, input.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  async createSignedUpload(input: {
    userId: string;
    source: string;
    fileName: string;
    expiresInSeconds: number;
    maxBytes: number;
  }): Promise<{
    uploadUrl: string;
    uploadHeaders: Record<string, string>;
    expiresAt: string;
    maxBytes: number;
    storageBucket: string;
    storageKey: string;
  }> {
    const storageKey = `${input.userId}/${crypto.randomUUID()}-${input.fileName}`;
    const signed = await this.client.storage.from(this.bucket).createSignedUploadUrl(storageKey);
    if (signed.error || !signed.data) {
      throw new Error(`Failed to create signed upload URL: ${signed.error?.message ?? 'unknown error'}`);
    }

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/upload/sign/${this.bucket}/${storageKey}?token=${signed.data.token}`;

    return {
      uploadUrl,
      uploadHeaders: {
        'x-upsert': 'false'
      },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
      maxBytes: input.maxBytes,
      storageBucket: this.bucket,
      storageKey
    };
  }

  async readArtifact(path: string): Promise<unknown> {
    const response = await this.client.storage.from(this.bucket).download(path);
    if (response.error || !response.data) {
      throw new Error(`Failed to fetch artifact from storage: ${response.error?.message ?? 'not found'}`);
    }

    const body = await response.data.text();
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
}

export class HttpQueueService implements QueueService {
  private readonly dispatchUrl: string;
  private readonly dispatchToken: string;

  constructor(input: { dispatchUrl: string; dispatchToken: string }) {
    this.dispatchUrl = input.dispatchUrl;
    this.dispatchToken = input.dispatchToken;
  }

  async enqueue(topic: 'ingest' | 'drop', payload: Record<string, string>): Promise<void> {
    const response = await fetch(this.dispatchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.dispatchToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        payload
      })
    });

    if (!response.ok) {
      throw new Error(`Queue dispatch failed with status ${response.status}.`);
    }
  }
}

export class DeterministicLlmService implements LlmService {
  async redactAndSummarize(input: { sourceText: string; source: string }): Promise<{ summary: string; piiRiskScore: number }> {
    const sanitized = input.sourceText
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted_email]')
      .replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, '[redacted_ssn]')
      .replace(/\b\d{10,15}\b/g, '[redacted_phone]')
      .slice(0, 1600);

    return {
      summary: `Source: ${input.source}. ${sanitized}`,
      piiRiskScore: sanitized.includes('[redacted_') ? 1 : 0
    };
  }

  async generateVibeCheck(input: { summary: string }): Promise<string> {
    const trimmed = input.summary.slice(0, 220);
    return `You overthink patterns, value depth, and keep showing up. ${trimmed}`.slice(0, 320);
  }

  async generatePairContent(input: { profileA: string; profileB: string }): Promise<{ synergyPoints: [string, string]; confessionPrompt: string }> {
    const excerpt = (text: string): string =>
      text
        .split(/[\n.!?]/)
        .map((part) => part.trim())
        .find((part) => part.length > 0)
        ?.slice(0, 96) ?? 'a recurring thread';

    const profileAExcerpt = excerpt(input.profileA);
    const profileBExcerpt = excerpt(input.profileB);

    return {
      synergyPoints: [
        `You both keep circling back to ${profileAExcerpt}.`,
        `There is overlap between "${profileAExcerpt}" and "${profileBExcerpt}".`
      ],
      confessionPrompt: `What changed the way you think about "${profileBExcerpt}"?`
    };
  }
}

export class DeterministicEmbeddingService implements EmbeddingService {
  async embed(input: string): Promise<number[]> {
    const vector = new Array<number>(1536).fill(0);
    for (let index = 0; index < input.length; index += 1) {
      vector[index % 1536] += input.charCodeAt(index) / 65535;
    }
    return vector;
  }
}

export function createSupabaseAuthFromEnv(env: Record<string, string | undefined>): AuthService {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for SupabaseAuthService.');
  }

  return new SupabaseAuthService({ supabaseUrl, supabaseAnonKey });
}

export function createSupabaseStorageFromEnv(env: Record<string, string | undefined>): StorageService {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.SUPABASE_STORAGE_BUCKET ?? 'raw-ingestion-staging';
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for SupabaseStorageService.');
  }

  return new SupabaseStorageService({
    supabaseUrl,
    supabaseServiceRoleKey,
    bucket
  });
}

export function createQueueServiceFromEnv(env: Record<string, string | undefined>): QueueService {
  const dispatchUrl = env.QUEUE_DISPATCH_URL;
  const dispatchToken = env.QUEUE_DISPATCH_TOKEN;
  if (!dispatchUrl || !dispatchToken) {
    throw new Error('QUEUE_DISPATCH_URL and QUEUE_DISPATCH_TOKEN are required for HttpQueueService.');
  }

  return new HttpQueueService({ dispatchUrl, dispatchToken });
}
