/// <reference types="@cloudflare/workers-types" />

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresRepository } from './postgres-repository.js';
import {
  createSupabaseAuthFromEnv,
  createSupabaseStorageFromEnv,
  HttpQueueService
} from './adapters.js';
import {
  AnthropicLlmService,
  FallbackLlmService,
  OpenAiEmbeddingService,
  OpenAiLlmService
} from './ai-providers.js';
import type { AppDependencies } from './dependencies.js';

/**
 * Cloudflare Worker environment bindings.
 *
 * Secrets (set via `wrangler secret put`):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY,
 *   QUEUE_DISPATCH_URL, QUEUE_DISPATCH_TOKEN, INTERNAL_ADMIN_TOKEN
 *
 * Vars (set in wrangler.jsonc or dashboard):
 *   APP_MODE, APP_PUBLIC_ORIGIN, SUPABASE_STORAGE_BUCKET,
 *   LLM_PRIMARY, OPENAI_LLM_MODEL, ANTHROPIC_LLM_MODEL,
 *   EMBEDDING_MODEL, MAX_UPLOAD_MB, SIGNED_UPLOAD_TTL_SEC,
 *   RAW_HARD_TTL_MINUTES, CHAT_POLL_FOREGROUND_SEC,
 *   CHAT_POLL_BACKGROUND_SEC, PROCESSING_POLL_MS
 */
export interface Env {
  // Hyperdrive binding for Postgres
  HYPERDRIVE: Hyperdrive;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET?: string;

  // AI providers
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_LLM_MODEL?: string;
  ANTHROPIC_LLM_MODEL?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_BASE_URL?: string;
  LLM_PRIMARY?: string;

  // Queue
  QUEUE_DISPATCH_URL?: string;
  QUEUE_DISPATCH_TOKEN?: string;

  // App config
  APP_MODE?: string;
  APP_PUBLIC_ORIGIN?: string;
  INTERNAL_ADMIN_TOKEN?: string;
  MAX_UPLOAD_MB?: string;
  SIGNED_UPLOAD_TTL_SEC?: string;
  RAW_HARD_TTL_MINUTES?: string;
  CHAT_POLL_FOREGROUND_SEC?: string;
  CHAT_POLL_BACKGROUND_SEC?: string;
  PROCESSING_POLL_MS?: string;
}

function buildDependencies(env: Env): AppDependencies {
  // Flatten env bindings into a plain Record for helpers that expect it
  const envRecord: Record<string, string | undefined> = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: env.SUPABASE_STORAGE_BUCKET,
    QUEUE_DISPATCH_URL: env.QUEUE_DISPATCH_URL,
    QUEUE_DISPATCH_TOKEN: env.QUEUE_DISPATCH_TOKEN,
    APP_MODE: env.APP_MODE,
    APP_PUBLIC_ORIGIN: env.APP_PUBLIC_ORIGIN,
    INTERNAL_ADMIN_TOKEN: env.INTERNAL_ADMIN_TOKEN,
    MAX_UPLOAD_MB: env.MAX_UPLOAD_MB,
    SIGNED_UPLOAD_TTL_SEC: env.SIGNED_UPLOAD_TTL_SEC,
    RAW_HARD_TTL_MINUTES: env.RAW_HARD_TTL_MINUTES,
    CHAT_POLL_FOREGROUND_SEC: env.CHAT_POLL_FOREGROUND_SEC,
    CHAT_POLL_BACKGROUND_SEC: env.CHAT_POLL_BACKGROUND_SEC,
    PROCESSING_POLL_MS: env.PROCESSING_POLL_MS,
    EMBEDDING_MODEL: env.EMBEDDING_MODEL,
    LLM_PRIMARY: env.LLM_PRIMARY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    OPENAI_LLM_MODEL: env.OPENAI_LLM_MODEL,
    ANTHROPIC_LLM_MODEL: env.ANTHROPIC_LLM_MODEL
  };

  // Postgres via Hyperdrive
  const databaseUrl = env.HYPERDRIVE.connectionString;
  const repository = new PostgresRepository(databaseUrl);

  // AI services
  const openAiKey = env.OPENAI_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openAiModel = env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini';
  const anthropicModel = env.ANTHROPIC_LLM_MODEL ?? 'claude-3-5-haiku-latest';
  const embeddingModel = env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const preferred = env.LLM_PRIMARY ?? 'openai';

  const llmBaseUrl = env.OPENAI_BASE_URL;
  const embeddingBaseUrl = env.EMBEDDING_BASE_URL;

  const openAi = new OpenAiLlmService({ apiKey: openAiKey, model: openAiModel, baseUrl: llmBaseUrl });
  const anthropic = anthropicKey
    ? new AnthropicLlmService({ apiKey: anthropicKey, model: anthropicModel })
    : undefined;

  const primary = preferred === 'anthropic' ? (anthropic ?? openAi) : openAi;
  const secondary = preferred === 'anthropic' ? openAi : anthropic;

  return {
    config: loadConfig(envRecord),
    repository,
    authService: createSupabaseAuthFromEnv(envRecord),
    storageService: createSupabaseStorageFromEnv(envRecord),
    queueService: new HttpQueueService({
      dispatchUrl: env.QUEUE_DISPATCH_URL ?? '',
      dispatchToken: env.QUEUE_DISPATCH_TOKEN ?? ''
    }),
    llmService: new FallbackLlmService({ primary, secondary }),
    embeddingService: new OpenAiEmbeddingService({ apiKey: openAiKey, model: embeddingModel, baseUrl: embeddingBaseUrl }),
    clock: () => new Date()
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const deps = buildDependencies(env);
    const app = createApp(deps);
    return app.fetch(request, env, _ctx);
  }
};
