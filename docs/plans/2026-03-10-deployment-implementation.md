# Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Contexted with Cloudflare Pages (frontend) + Cloudflare Workers (backend) + Supabase (database/auth/storage).

**Architecture:** The Hono app gets a Worker entrypoint that exports `fetch`. The frontend gets an API base URL for cross-origin requests. The `postgres` driver connects through Hyperdrive. Supabase handles auth, storage, and Postgres.

**Tech Stack:** Cloudflare Workers, Cloudflare Pages, Hono, Wrangler, Hyperdrive, Supabase, `postgres` (porsager)

---

## Phase 1: Port Backend to Cloudflare Workers

### Task 1: Create Worker entrypoint

**Files:**
- Create: `apps/api-worker/src/worker.ts`

**Step 1: Create the Worker entrypoint**

Create `apps/api-worker/src/worker.ts` that exports a `fetch` handler for Cloudflare Workers:

```typescript
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import {
  SupabaseAuthService,
  SupabaseStorageService,
  HttpQueueService
} from './adapters.js';
import {
  FallbackLlmService,
  OpenAiEmbeddingService,
  OpenAiLlmService,
  AnthropicLlmService
} from './ai-providers.js';
import { PostgresRepository } from './postgres-repository.js';
import type { AppDependencies } from './dependencies.js';

export interface Env {
  // Hyperdrive binding
  HYPERDRIVE: Hyperdrive;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;

  // AI
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_LLM_MODEL?: string;
  ANTHROPIC_LLM_MODEL?: string;
  EMBEDDING_MODEL?: string;
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

function createWorkerDependencies(env: Env): AppDependencies {
  const databaseUrl = env.HYPERDRIVE.connectionString;
  const repository = new PostgresRepository(databaseUrl);

  const envRecord: Record<string, string | undefined> = {
    APP_MODE: 'postgres',
    INTERNAL_ADMIN_TOKEN: env.INTERNAL_ADMIN_TOKEN,
    MAX_UPLOAD_MB: env.MAX_UPLOAD_MB,
    SIGNED_UPLOAD_TTL_SEC: env.SIGNED_UPLOAD_TTL_SEC,
    RAW_HARD_TTL_MINUTES: env.RAW_HARD_TTL_MINUTES,
    CHAT_POLL_FOREGROUND_SEC: env.CHAT_POLL_FOREGROUND_SEC,
    CHAT_POLL_BACKGROUND_SEC: env.CHAT_POLL_BACKGROUND_SEC,
    PROCESSING_POLL_MS: env.PROCESSING_POLL_MS,
    EMBEDDING_MODEL: env.EMBEDDING_MODEL
  };

  const openAiKey = env.OPENAI_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openAiModel = env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini';
  const anthropicModel = env.ANTHROPIC_LLM_MODEL ?? 'claude-3-5-haiku-latest';
  const embeddingModel = env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const preferred = env.LLM_PRIMARY ?? 'openai';

  const openAi = new OpenAiLlmService({ apiKey: openAiKey, model: openAiModel });
  const anthropic = anthropicKey
    ? new AnthropicLlmService({ apiKey: anthropicKey, model: anthropicModel })
    : undefined;

  const primary = preferred === 'anthropic' ? anthropic ?? openAi : openAi;
  const secondary = preferred === 'anthropic' ? openAi : anthropic;

  const authService = new SupabaseAuthService({
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY
  });

  const storageService = new SupabaseStorageService({
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_STORAGE_BUCKET ?? 'raw-ingestion-staging'
  });

  const queueService = new HttpQueueService({
    dispatchUrl: env.QUEUE_DISPATCH_URL ?? '',
    dispatchToken: env.QUEUE_DISPATCH_TOKEN ?? ''
  });

  return {
    config: loadConfig(envRecord),
    repository,
    authService,
    storageService,
    queueService,
    llmService: new FallbackLlmService({ primary, secondary }),
    embeddingService: new OpenAiEmbeddingService({ apiKey: openAiKey, model: embeddingModel }),
    clock: () => new Date()
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const deps = createWorkerDependencies(env);
    const app = createApp(deps);
    return app.fetch(request);
  }
};
```

**Step 2: Commit**

```bash
git add apps/api-worker/src/worker.ts
git commit -m "feat: add Cloudflare Worker entrypoint"
```

---

### Task 2: Replace `node:crypto` imports with Web Crypto API

The Worker runtime supports `node:crypto` in compatibility mode, but it's cleaner to use Web Crypto. There are two files to fix.

**Files:**
- Modify: `apps/api-worker/src/utils.ts`
- Modify: `apps/api-worker/src/app.ts`

**Step 1: Fix `utils.ts` — replace `createHash` with Web Crypto**

Replace `hashRevealToken` to use the Web Crypto API. Since it's used in an async context (route handlers call `await`), make it async:

```typescript
// utils.ts — replace the import and hashRevealToken function
// OLD:
import { createHash } from 'node:crypto';
// ...
export function hashRevealToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// NEW:
export async function hashRevealToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Then update `app.ts` to await the call:

```typescript
// app.ts line ~759 — change:
const tokenHash = hashRevealToken(c.req.param('token'));
// to:
const tokenHash = await hashRevealToken(c.req.param('token'));
```

**Step 2: Fix `app.ts` — replace `timingSafeEqual` from `node:crypto`**

Replace with a constant-time comparison using Web Crypto:

```typescript
// app.ts — remove: import { timingSafeEqual } from 'node:crypto';
// Replace hasInternalAdminAccess with:
function hasInternalAdminAccess(c: Context, deps: AppDependencies): boolean {
  const expected = deps.config.internalAdminToken?.trim();
  const provided = c.req.header('X-Internal-Admin-Token')?.trim();

  if (!expected || !provided) {
    return false;
  }

  if (expected.length !== provided.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(provided);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
```

**Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS (no errors)

**Step 4: Run tests**

```bash
npm run test
```

Expected: PASS (all tests pass, since tests use in-memory mode which doesn't hit these code paths differently)

**Step 5: Commit**

```bash
git add apps/api-worker/src/utils.ts apps/api-worker/src/app.ts
git commit -m "refactor: replace node:crypto with Web Crypto API for Workers compat"
```

---

### Task 3: Add `wrangler.jsonc` configuration

**Files:**
- Create: `apps/api-worker/wrangler.jsonc`

**Step 1: Create the Wrangler config**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "contexted-api",
  "main": "src/worker.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],

  // Hyperdrive binding for Supabase Postgres
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<HYPERDRIVE_ID>"
    }
  ],

  "env": {
    "staging": {
      "name": "contexted-api-staging",
      "routes": [
        { "pattern": "api-staging.contexted.app", "zone_name": "contexted.app" }
      ],
      "hyperdrive": [
        {
          "binding": "HYPERDRIVE",
          "id": "<STAGING_HYPERDRIVE_ID>"
        }
      ]
    },
    "production": {
      "name": "contexted-api",
      "routes": [
        { "pattern": "api.contexted.app", "zone_name": "contexted.app" }
      ]
    }
  }
}
```

**Step 2: Add wrangler as a dev dependency**

```bash
cd apps/api-worker && npm install -D wrangler
```

**Step 3: Add deploy scripts to `apps/api-worker/package.json`**

Add to `scripts`:

```json
"deploy:staging": "wrangler deploy --env staging",
"deploy:production": "wrangler deploy --env production",
"dev:worker": "wrangler dev"
```

**Step 4: Commit**

```bash
git add apps/api-worker/wrangler.jsonc apps/api-worker/package.json package-lock.json
git commit -m "feat: add wrangler config and deploy scripts"
```

---

### Task 4: Verify `postgres` driver works through Hyperdrive

**Context:** The `postgres` (porsager) driver works with Hyperdrive when you pass `{ prepare: false }` in the connection options, since Hyperdrive doesn't support prepared statements.

**Files:**
- Modify: `apps/api-worker/src/postgres-repository.ts`

**Step 1: Add `prepare: false` to the postgres connection**

Find the constructor in `postgres-repository.ts` where the `postgres` client is created. It should look like:

```typescript
this.sql = postgres(databaseUrl);
```

Change it to:

```typescript
this.sql = postgres(databaseUrl, { prepare: false });
```

This is necessary because Hyperdrive proxies the connection and doesn't support Postgres extended protocol (prepared statements).

**Step 2: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/api-worker/src/postgres-repository.ts
git commit -m "fix: disable prepared statements for Hyperdrive compatibility"
```

---

## Phase 2: Frontend Origin Handling

### Task 5: Add API base URL to frontend

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/vite.config.ts`

**Step 1: Add `VITE_API_BASE_URL` to the API client**

In `apps/web/src/api.ts`, prepend the base URL to all fetch calls:

```typescript
// Add at top of file:
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// Then in apiRequestRaw, change:
const response = await fetch(path, {
// to:
const response = await fetch(`${API_BASE}${path}`, {

// Same change in apiRequest:
const response = await fetch(path, {
// to:
const response = await fetch(`${API_BASE}${path}`, {
```

**Step 2: Verify dev still works**

In dev, `VITE_API_BASE_URL` is unset, so `API_BASE` is `''`, and the Vite proxy still handles `/v1` requests. No change needed in `vite.config.ts`.

For production, set `VITE_API_BASE_URL=https://api.contexted.app` in the Cloudflare Pages build environment.

**Step 3: Run frontend tests**

```bash
cd apps/web && npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/api.ts
git commit -m "feat: add VITE_API_BASE_URL for cross-origin API calls"
```

---

### Task 6: Fix referral URL origin

**Files:**
- Modify: `apps/api-worker/src/app.ts`

**Step 1: Use `APP_PUBLIC_ORIGIN` for invite URLs**

In `app.ts`, the `/v1/referrals/me` handler builds invite URLs from `c.req.url` origin (line ~244):

```typescript
const origin = new URL(c.req.url).origin;
return c.json({
  invite_url: `${origin}/?invite=${inviteCode}`,
```

Change to:

```typescript
const origin = deps.config.appPublicOrigin ?? new URL(c.req.url).origin;
return c.json({
  invite_url: `${origin}/?invite=${inviteCode}`,
```

**Step 2: Add `appPublicOrigin` to `AppConfig`**

In `dependencies.ts`, add to `AppConfig`:

```typescript
appPublicOrigin?: string;
```

In `config.ts`, add to `loadConfig`:

```typescript
appPublicOrigin: env.APP_PUBLIC_ORIGIN,
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add apps/api-worker/src/app.ts apps/api-worker/src/dependencies.ts apps/api-worker/src/config.ts
git commit -m "feat: use APP_PUBLIC_ORIGIN for referral invite URLs"
```

---

### Task 7: Add CORS middleware

**Files:**
- Modify: `apps/api-worker/src/app.ts`

**Step 1: Add CORS headers to the Hono app**

Since the frontend (`contexted.app`) and API (`api.contexted.app`) are on different subdomains, CORS is required.

At the top of `createApp`, before routes:

```typescript
import { cors } from 'hono/cors';

// Inside createApp, before routes:
const allowedOrigins = deps.config.appPublicOrigin
  ? [deps.config.appPublicOrigin]
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use('*', cors({
  origin: allowedOrigins,
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'If-None-Match', 'X-Internal-Admin-Token', 'X-App-Background'],
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  exposeHeaders: ['ETag'],
  maxAge: 86400,
  credentials: true,
}));
```

**Step 2: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/api-worker/src/app.ts
git commit -m "feat: add CORS middleware for cross-origin frontend"
```

---

## Phase 3: Supabase Setup (Interactive Walkthrough)

### Task 8: Create Supabase production project and apply migrations

This task is done interactively in the Supabase dashboard + CLI.

**Step 1: Verify Supabase project exists**

Using the Supabase MCP tools, list tables to check if migrations have been applied. If the project is empty, apply migrations.

**Step 2: Apply migrations**

Use the Supabase MCP `apply_migration` tool to apply each migration file in order:

1. `packages/db/migrations/001_init.sql`
2. `packages/db/migrations/002_match_text_and_history_idx.sql`
3. `packages/db/migrations/003_referrals_and_priority_credits.sql`

**Step 3: Verify pgvector is enabled**

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Step 4: Configure Auth**

In Supabase dashboard:
- Enable Email (magic link) auth provider
- Set Site URL to `https://contexted.app`
- Add redirect URLs:
  - `https://contexted.app/*`
  - `https://staging.contexted.app/*`
  - `http://localhost:5173/*` (for development)

**Step 5: Create storage bucket**

Create a bucket named `raw-ingestion-staging` (or whatever `SUPABASE_STORAGE_BUCKET` is set to).

---

## Phase 4: Cloudflare Setup (Interactive Walkthrough)

### Task 9: Set up Cloudflare Pages for frontend

**Step 1: Create Pages project**

In Cloudflare dashboard or via Wrangler:
- Project name: `contexted-web`
- Build command: `npm run build --prefix apps/web`
- Build output directory: `apps/web/dist`
- Root directory: `/` (monorepo root)
- Environment variable: `VITE_API_BASE_URL=https://api.contexted.app`
- Framework preset: None (Vite)

**Step 2: Attach custom domain**

Attach `contexted.app` to the Pages project.

---

### Task 10: Set up Cloudflare Hyperdrive

**Step 1: Create Hyperdrive config**

```bash
npx wrangler hyperdrive create contexted-db --connection-string="postgres://USER:PASS@HOST:PORT/DB?sslmode=require"
```

This outputs a Hyperdrive ID. Put that ID in `wrangler.jsonc` replacing `<HYPERDRIVE_ID>`.

---

### Task 11: Set Worker secrets

**Step 1: Set secrets via wrangler**

```bash
cd apps/api-worker
echo "VALUE" | npx wrangler secret put SUPABASE_URL --env production
echo "VALUE" | npx wrangler secret put SUPABASE_ANON_KEY --env production
echo "VALUE" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
echo "VALUE" | npx wrangler secret put OPENAI_API_KEY --env production
echo "VALUE" | npx wrangler secret put INTERNAL_ADMIN_TOKEN --env production
echo "VALUE" | npx wrangler secret put QUEUE_DISPATCH_URL --env production
echo "VALUE" | npx wrangler secret put QUEUE_DISPATCH_TOKEN --env production
# Optional:
echo "VALUE" | npx wrangler secret put ANTHROPIC_API_KEY --env production
```

Also set non-secret env vars in `wrangler.jsonc` under `env.production`:

```jsonc
"vars": {
  "APP_MODE": "postgres",
  "APP_PUBLIC_ORIGIN": "https://contexted.app",
  "SUPABASE_STORAGE_BUCKET": "raw-ingestion-staging",
  "LLM_PRIMARY": "openai"
}
```

---

### Task 12: Deploy and smoke test

**Step 1: Deploy Worker to staging**

```bash
cd apps/api-worker && npx wrangler deploy --env staging
```

**Step 2: Smoke test**

```bash
curl https://api-staging.contexted.app/health
# Expected: {"ok":true}
```

**Step 3: Deploy frontend to staging**

Push to a branch and verify the Pages preview deployment loads and can reach the staging API.

**Step 4: Full flow test**

1. Visit staging frontend
2. Request a magic link
3. Verify auth flow completes
4. Upload content
5. Verify processing works end-to-end

---

## Phase 5: CI/CD Deployment Automation

### Task 13: Add deployment workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create deployment workflow**

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: cd apps/api-worker && npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: cd apps/web && npm run build
        env:
          VITE_API_BASE_URL: https://api.contexted.app
      - uses: cloudflare/wrangler-action@v3
        with:
          command: pages deploy apps/web/dist --project-name=contexted-web
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Step 2: Add GitHub secrets**

In GitHub repo settings → Secrets:
- `CLOUDFLARE_API_TOKEN` — from Cloudflare dashboard
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add CI/CD deployment workflow for Pages and Workers"
```

---

## Summary: Execution Order

| # | Task | Type | Depends On |
|---|------|------|------------|
| 1 | Worker entrypoint | Code | — |
| 2 | Replace `node:crypto` | Code | — |
| 3 | `wrangler.jsonc` | Code | 1 |
| 4 | Hyperdrive `prepare: false` | Code | — |
| 5 | Frontend API base URL | Code | — |
| 6 | Referral URL origin | Code | — |
| 7 | CORS middleware | Code | — |
| 8 | Supabase setup | Infra | — |
| 9 | Cloudflare Pages setup | Infra | 5 |
| 10 | Hyperdrive setup | Infra | 3, 4, 8 |
| 11 | Worker secrets | Infra | 10 |
| 12 | Deploy + smoke test | Infra | all above |
| 13 | CI/CD workflow | Code | 12 |

Tasks 1–7 are parallelizable code changes. Tasks 8–12 are interactive infra setup done together. Task 13 is automation after the first successful deploy.
