# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contexted is a peer-matching application MVP. Users upload profile content (chat exports, social media), which gets AI-summarized and embedded, then matched with compatible users in scheduled "drops." Matched users exchange confessions, unlock reveals, and chat.

## Monorepo Structure

npm workspaces monorepo with four packages:

- **`apps/api-worker`** — Hono REST API (designed for Cloudflare Workers, runs on Node locally)
- **`apps/web`** — React 19 SPA with TanStack Router, Vite dev server
- **`packages/shared`** — Zod validation schemas, enums, state machine, matching algorithms, sanitization
- **`packages/db`** — SQL migrations only (no-op build/test/lint), apply to Supabase

## Commands

```bash
# Install
npm install

# Run all workspace scripts from root
npm run build           # tsc across all packages
npm run typecheck       # tsc --noEmit across all packages
npm run test            # vitest run across all packages
npm run test:coverage   # vitest run --coverage across all packages
npm run safety:scan     # destructive command guard (scripts/dcg-scan.sh)

# Run a single test file
cd apps/api-worker && npx vitest run test/app.test.ts
cd packages/shared && npx vitest run test/validation.test.ts

# Dev servers
cd apps/api-worker && npm run dev   # builds shared first, then runs Node dev-server
cd apps/web && npm run dev          # Vite on :5173, proxies /v1 and /r to API
```

## Architecture

### Dependency Injection

The API worker uses constructor-style DI via `AppDependencies` (defined in `dependencies.ts`). All external services are typed interfaces:

- `Repository` — data access (Postgres or in-memory)
- `AuthService` — Supabase magic link auth
- `StorageService` — signed upload URLs
- `QueueService` — async job dispatch (ingest, drop)
- `LlmService` — redaction/summarization, vibe checks, pair content
- `EmbeddingService` — vector embeddings

`factories.ts` provides `createRuntimeDependencies()` (Postgres + real services) and `createInMemoryDependencies()` (for tests). The Hono app receives dependencies through `app.ts`'s `createApp(deps)` function.

### Request Flow

Routes in `app.ts` use middleware from `http-utils.ts`: auth extraction, JSON body validation (via shared Zod schemas), idempotency key enforcement, and error mapping. Services in `services/` orchestrate business logic between the repository and external services.

### Shared Package as Source of Truth

`@contexted/shared` owns all API contract validation (Zod schemas in `validation.ts`), business enums (`enums.ts`), profile/match lifecycle rules (`state-machine.ts`), and similarity scoring (`matching.ts`). Both the API and web app import from this package. The path alias `@contexted/shared` resolves to `packages/shared/src/index.ts` via tsconfig paths.

### Frontend

React 19 + TanStack Router with file-based route definitions in `router.tsx`. The API client (`api.ts`) handles typed HTTP calls. Long-polling for real-time updates is managed in `polling.ts`. Vite proxies `/v1` and `/r` routes to the API during development.

### Database

Supabase Postgres with RLS. The full schema is in `packages/db/migrations/001_init.sql` (18+ tables). Key patterns: HNSW vector index for embeddings, idempotency_keys table for request dedup, outbox_events for event sourcing, TTL-based raw content expiry.

## Key Conventions

- **TypeScript strict mode**, ES2022 target, ESNext modules with bundler resolution
- **Zod for all validation** — schemas defined in shared, used in both API and frontend
- **Coverage threshold: 60%** across all packages (statements, branches, functions, lines)
- **Test environment**: Node for api-worker and shared; jsdom for web
- **No lint tooling configured yet** — lint scripts are no-ops
- **CI**: GitHub Actions runs `safety:scan` → `typecheck` → `test:coverage` on PRs and pushes to main
- **Safety scan** (`scripts/dcg-scan.sh`): greps scripts/docs/CI files for destructive patterns (e.g., `rm -rf /`, `drop database`, `git reset --hard`). Runs in CI and blocks on matches.
