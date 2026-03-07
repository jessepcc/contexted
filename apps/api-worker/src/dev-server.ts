import { serve } from '@hono/node-server';
import { InMemoryAuthService, InMemoryQueueService } from './adapters.js';
import { createApp } from './app.js';
import { createRuntimeDependencies } from './factories.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { processIngestionJob } from './services/ingestion-service.js';

process.env.APP_MODE = process.env.APP_MODE ?? 'memory';

const deps = createRuntimeDependencies(process.env);

if (process.env.APP_MODE === 'memory') {
  const devUser = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'dev@contexted.local',
    status: 'processing' as const,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  };

  if (deps.repository instanceof InMemoryRepository) {
    await deps.repository.upsertUser(devUser);
  }

  if (deps.authService instanceof InMemoryAuthService) {
    deps.authService.seedToken('dev-token', {
      id: devUser.id,
      email: devUser.email
    });
  }

  if (deps.queueService instanceof InMemoryQueueService) {
    deps.queueService.onEnqueue = (topic, payload) => {
      if (topic === 'ingest') {
        const sourceText =
          payload.sourceText ??
          'I have been thinking a lot about how AI changes the way we communicate. ' +
            'My conversations with ChatGPT often turn into deep philosophical discussions about consciousness. ' +
            'I value authenticity and depth over small talk. I am curious about human connection in a digital age. ' +
            'I overthink patterns but I keep showing up. I love creative projects and building things that matter.';
        void processIngestionJob(deps, {
          jobId: payload.jobId,
          sourceText
        })
          .then(() => console.log(`[dev] ingestion job ${payload.jobId} auto-processed`))
          .catch((err) => console.error(`[dev] ingestion job ${payload.jobId} failed:`, err));
      }
    };
  }
}

const app = createApp(deps);
const port = Number.parseInt(process.env.API_PORT ?? '8787', 10);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info: { port: number }) => {
    console.log(`[api-worker] listening on http://localhost:${info.port} (mode=${process.env.APP_MODE})`);
    if (process.env.APP_MODE === 'memory') {
      console.log('[api-worker] dev auth token: dev-token');
    }
  }
);
