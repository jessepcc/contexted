# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contexted is a peer-matching application MVP. Users upload profile content (chat exports, social media), which gets AI-summarized and embedded, then matched with compatible users in scheduled "drops." Matched users exchange confessions, unlock reveals, and chat. The current MVP also includes a private-invite loop: users can share a private invite link, invitees can claim it through auth, and successful referred signups earn both sides earlier consideration in future drops.

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

# Database migrations (requires .env.test or .env.production with DB credentials)
npm run db:migrate:test             # apply migrations to test DB
npm run db:migrate:prod             # apply migrations to production DB

# API against different environments
cd apps/api-worker && npm run dev:test   # runs with .env.test
cd apps/api-worker && npm run dev:prod   # runs with .env.production
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

Private-invite routes live in `apps/api-worker/src/app.ts` and are intentionally narrow:

- `GET /v1/referrals/me`
- `POST /v1/referrals/claim`
- `POST /v1/referrals/:invite_code/click`

Invite qualification happens during `/v1/waitlist/enroll`, not during signup.

### Shared Package as Source of Truth

`@contexted/shared` owns all API contract validation (Zod schemas in `validation.ts`), business enums (`enums.ts`), profile/match lifecycle rules (`state-machine.ts`), and similarity scoring (`matching.ts`). Both the API and web app import from this package. The path alias `@contexted/shared` resolves to `packages/shared/src/index.ts` via tsconfig paths.

### Frontend

React 19 + TanStack Router with file-based route definitions in `router.tsx`. The API client (`api.ts`) handles typed HTTP calls. Long-polling for real-time updates is managed in `polling.ts`. Vite proxies `/v1` and `/r` routes to the API during development.

**Styling**: Tailwind CSS v4 (uses `@theme` directive, not `theme.extend`). Design tokens defined in `apps/web/src/styles.css`. Fonts: Manrope (body/`--font-sans`), Sora (headings/`--font-heading`). Warm earth-toned palette with accent `#D4714E`. Animation library: `motion` (framer-motion v12+ rebrand). `PageShell` component wraps all pages with animated `BlurBlobs` background.

The invite flow is split across:

- `apps/web/src/referrals.ts` — local/session storage helpers, referral API helpers, invite-share content
- `apps/web/src/pages/LandingPage.tsx` — invite banner + click capture
- `apps/web/src/pages/LoginPage.tsx` / `apps/web/src/pages/VerifyPage.tsx` — invite persistence through magic-link auth
- `apps/web/src/pages/AppGatewayPage.tsx` — post-auth claim handoff
- `apps/web/src/components/ReferralInviteCard.tsx` — shared invite UI used in waiting/expired states

### Database

Supabase Postgres with RLS. The base schema is in `packages/db/migrations/001_init.sql`, with follow-up indexes and feature migrations in `packages/db/migrations/002_match_text_and_history_idx.sql` and `packages/db/migrations/003_referrals_and_priority_credits.sql`. Key patterns: HNSW vector index for embeddings, idempotency_keys table for request dedup, outbox_events for event sourcing, TTL-based raw content expiry, and invite/referral tables for the private-invite loop.

## Key Conventions

- **Node >= 20** required (api-worker uses `--env-file` flag)
- **Postgres driver**: `postgres` (porsager/postgres), NOT `pg` — uses tagged template literals for queries
- **TypeScript strict mode**, ES2022 target, ESNext modules with bundler resolution
- **Zod for all validation** — schemas defined in shared, used in both API and frontend
- **Matching stays compatibility-first** — referral priority only affects first-pass ordering; it does not override candidate scoring
- **Coverage threshold: 60%** across all packages (statements, branches, functions, lines)
- **Test environment**: Node for api-worker and shared; jsdom for web
- **No lint tooling configured yet** — lint scripts are no-ops
- **CI**: GitHub Actions runs `safety:scan` → `typecheck` → `test:coverage` on PRs and pushes to main
- **Safety scan** (`scripts/dcg-scan.sh`): greps scripts/docs/CI files for destructive patterns (e.g., `rm -rf /`, `drop database`, `git reset --hard`). Runs in CI and blocks on matches.

## Feature Notes

- Private invites are designed to feel quiet and curated, not gamified.
- Earlier consideration means queue/order preference, not guaranteed matching.
- Bootstrap was intentionally left unchanged for the invite MVP; the web app claims pending invites after auth via the app gateway.
- See `docs/private-invites.md` for the operational flow and API contract.
