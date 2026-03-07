# Contexted MVP

Production-oriented MVP scaffold for Contexted, implemented as a TypeScript workspace.

## Workspace

- `apps/api-worker`: Hono API implementing MVP endpoint contracts.
- `apps/web`: React + TanStack Router PWA routes and client state machine.
- `packages/shared`: Shared schemas, enums, matching logic, sanitization.
- `packages/db`: Supabase/Postgres schema migration and RLS policies.

## Quick Start

1. `cp .env.example .env`
2. `npm install`
3. `npm run test:coverage`

Use `APP_MODE=memory` for local API smoke tests. For staging/production mode, configure Supabase, Postgres, queue dispatch, and AI provider keys from `.env.example`.

## Database

- Apply `packages/db/migrations/001_init.sql` in Supabase SQL editor or migration pipeline.
- The schema includes RLS on sensitive user-facing tables and indexes for FK/query paths.

## Runtime Integrations

- Auth: Supabase magic link (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- Storage: Supabase signed uploads and artifact reads (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`).
- Queue: HTTP dispatcher endpoint for Cloudflare Queue fan-out (`QUEUE_DISPATCH_URL`, `QUEUE_DISPATCH_TOKEN`).
- AI: OpenAI embeddings plus OpenAI/Anthropic LLM fallback (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_PRIMARY`).

## Safety Controls

- Mutating APIs use strict JSON schema validation and semantic state checks.
- Raw upload content is modeled as storage-only boundary with TTL metadata.
- Idempotency storage is enforced via `idempotency_keys`.
- CI runs `npm run safety:scan` to block high-risk destructive command patterns in automation/docs paths.

### Destructive Command Guard Setup

Install reference guard locally (recommended in addition to repo scan):

```bash
curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/destructive_command_guard/main/install.sh?$(date +%s)" | bash -s -- --easy-mode
```

## CI

GitHub Actions workflow runs typecheck + coverage on each PR and push.
