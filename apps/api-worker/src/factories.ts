import { loadConfig } from './config.js';
import {
  AnthropicLlmService,
  FallbackLlmService,
  OpenAiEmbeddingService,
  OpenAiLlmService
} from './ai-providers.js';
import {
  createQueueServiceFromEnv,
  createSupabaseStorageFromEnv,
  DeterministicEmbeddingService,
  DeterministicLlmService,
  createSupabaseAuthFromEnv,
  InMemoryAuthService,
  InMemoryQueueService,
  InMemoryStorageService
} from './adapters.js';
import type { AppDependencies, QueueService } from './dependencies.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { PostgresRepository } from './postgres-repository.js';
import { processIngestionJob } from './services/ingestion-service.js';

function createAiDependenciesFromEnv(env: Record<string, string | undefined>): {
  llmService: FallbackLlmService;
  embeddingService: OpenAiEmbeddingService;
} {
  const openAiKey = env.OPENAI_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openAiModel = env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini';
  const anthropicModel = env.ANTHROPIC_LLM_MODEL ?? 'claude-3-5-haiku-latest';
  const embeddingModel = env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const preferred = env.LLM_PRIMARY ?? 'openai';

  if (!openAiKey && !anthropicKey) {
    throw new Error('At least one of OPENAI_API_KEY or ANTHROPIC_API_KEY is required for runtime LLM.');
  }

  if (!openAiKey) {
    throw new Error('OPENAI_API_KEY is required for embeddings.');
  }

  const openAi = new OpenAiLlmService({
    apiKey: openAiKey,
    model: openAiModel,
    baseUrl: env.OPENAI_BASE_URL
  });
  const anthropic = anthropicKey
    ? new AnthropicLlmService({
        apiKey: anthropicKey,
        model: anthropicModel
      })
    : undefined;

  const primary = preferred === 'anthropic' ? anthropic ?? openAi : openAi;
  const secondary = preferred === 'anthropic' ? openAi : anthropic;

  return {
    llmService: new FallbackLlmService({
      primary,
      secondary
    }),
    embeddingService: new OpenAiEmbeddingService({
      apiKey: openAiKey,
      model: embeddingModel,
      baseUrl: env.EMBEDDING_BASE_URL
    })
  };
}

export function createInMemoryDependencies(env: Record<string, string | undefined> = {}): {
  deps: AppDependencies;
  auth: InMemoryAuthService;
  storage: InMemoryStorageService;
  queue: InMemoryQueueService;
  repository: InMemoryRepository;
} {
  const repository = new InMemoryRepository();
  const auth = new InMemoryAuthService();
  const storage = new InMemoryStorageService({ baseUrl: '' });
  const queue = new InMemoryQueueService();

  const deps: AppDependencies = {
    config: loadConfig(env),
    repository,
    authService: auth,
    storageService: storage,
    queueService: queue,
    llmService: new DeterministicLlmService(),
    embeddingService: new DeterministicEmbeddingService(),
    clock: () => new Date()
  };

  return {
    deps,
    auth,
    storage,
    queue,
    repository
  };
}

export function createRuntimeDependencies(env: Record<string, string | undefined>): AppDependencies {
  if (env.APP_MODE === 'memory') {
    return createInMemoryDependencies(env).deps;
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required unless APP_MODE=memory.');
  }

  const repository = new PostgresRepository(databaseUrl);

  const aiDependencies = createAiDependenciesFromEnv(env);

  let deps: AppDependencies;
  const queueService: QueueService =
    env.QUEUE_DISPATCH_URL && env.QUEUE_DISPATCH_TOKEN
      ? createQueueServiceFromEnv(env)
      : {
          async enqueue(topic, payload): Promise<void> {
            if (topic !== 'ingest') {
              return;
            }

            queueMicrotask(() => {
              void processIngestionJob(deps, {
                jobId: payload.jobId,
                sourceText: payload.sourceText
              }).catch((error) => {
                console.error(`[local-queue] ingestion failed job=${payload.jobId}:`, error);
              });
            });
          }
        };

  deps = {
    config: loadConfig(env),
    repository,
    authService: createSupabaseAuthFromEnv(env),
    storageService: createSupabaseStorageFromEnv(env),
    queueService,
    llmService: aiDependencies.llmService,
    embeddingService: aiDependencies.embeddingService,
    clock: () => new Date()
  };

  return deps;
}
