/// <reference types="@cloudflare/workers-types" />

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresRepository } from './postgres-repository.js';
import {
  createSupabaseAuthFromEnv,
  createSupabaseStorageFromEnv
} from './adapters.js';
import {
  AnthropicLlmService,
  FallbackLlmService,
  OpenAiEmbeddingService,
  OpenAiLlmService
} from './ai-providers.js';
import type { AppDependencies, QueueService } from './dependencies.js';
import { processIngestionJob } from './services/ingestion-service.js';

export interface Env {
  HYPERDRIVE: Hyperdrive;

  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET?: string;

  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_LLM_MODEL?: string;
  ANTHROPIC_LLM_MODEL?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_BASE_URL?: string;
  LLM_PRIMARY?: string;

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

class WaitUntilQueueService implements QueueService {
  private ctx: ExecutionContext;
  private deps: () => AppDependencies;

  constructor(ctx: ExecutionContext, deps: () => AppDependencies) {
    this.ctx = ctx;
    this.deps = deps;
  }

  async enqueue(topic: 'ingest' | 'drop', payload: Record<string, string>): Promise<void> {
    if (topic === 'ingest') {
      this.ctx.waitUntil(
        processIngestionJob(this.deps(), {
          jobId: payload.jobId,
          sourceText: payload.sourceText ?? ''
        }).catch((err) => console.error(`[worker] ingestion failed job=${payload.jobId}:`, err))
      );
    }
  }
}

function buildDependencies(env: Env, ctx: ExecutionContext): AppDependencies {
  const envRecord: Record<string, string | undefined> = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: env.SUPABASE_STORAGE_BUCKET,
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

  const databaseUrl = env.HYPERDRIVE.connectionString;
  const repository = new PostgresRepository(databaseUrl);

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

  // Lazy self-reference so the queue service can access deps
  let deps: AppDependencies;
  const queueService = new WaitUntilQueueService(ctx, () => deps);

  deps = {
    config: loadConfig(envRecord),
    repository,
    authService: createSupabaseAuthFromEnv(envRecord),
    storageService: createSupabaseStorageFromEnv(envRecord),
    queueService,
    llmService: new FallbackLlmService({ primary, secondary }),
    embeddingService: new OpenAiEmbeddingService({ apiKey: openAiKey, model: embeddingModel, baseUrl: embeddingBaseUrl }),
    clock: () => new Date()
  };

  return deps;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const deps = buildDependencies(env, ctx);
    const app = createApp(deps);
    return app.fetch(request, env, ctx);
  }
};
