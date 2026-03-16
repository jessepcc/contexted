# Deployment Plan

**Goal:** deploy Contexted with Cloudflare for the frontend and backend, and Supabase for database/auth/storage, while keeping the first production setup as close to the current codebase as possible.

## Recommended Architecture

### Frontend — Cloudflare

- **Host:** Cloudflare Pages
- **Domain:** `https://contexted.app`
- **Build target:** `apps/web`
- **Output:** static Vite bundle

### Backend — Cloudflare

- **Host:** Cloudflare Workers
- **Domain:** `https://api.contexted.app`
- **App runtime:** Hono on Workers
- **Background jobs:** Cloudflare Cron Triggers first, Cloudflare Queues second

### Database / Auth / Storage — Supabase

- **Relational DB:** Supabase Postgres
- **Vector search:** `pgvector`
- **Auth:** Supabase magic links
- **File storage:** Supabase Storage

## Why This Is The Right First Plan

- It keeps the public app runtime serverless and on Cloudflare.
- It keeps the current Postgres + `pgvector` data model instead of forcing a D1/Vectorize rewrite.
- It preserves the current auth and storage model already present in the repo.
- It minimizes migration risk while still giving you a Cloudflare-native frontend and backend story.

## Target Deployment Layout

### Production

- `contexted.app` → Cloudflare Pages
- `api.contexted.app` → Cloudflare Worker
- Supabase production project → Postgres, Auth, Storage

### Staging

- `staging.contexted.app` → Cloudflare Pages
- `api-staging.contexted.app` → Cloudflare Worker
- separate Supabase staging project

### Preview

- Cloudflare Pages preview deployments for branches
- preview Workers environment pointing at staging Supabase, never production Supabase

## How The Stack Maps To The Current Repo

### Frontend

- `apps/web` is already a static Vite app and is a natural fit for Pages.
- The current frontend calls relative API paths, so production needs either:
  - a public API base URL, or
  - Cloudflare routing that keeps API requests same-origin

### Backend

- `apps/api-worker` already uses Hono, which ports well to Workers.
- The current entrypoint is still Node-oriented, so it needs a Worker-specific runtime entry and config.

### Database

- The current repository already uses Postgres directly and already depends on `pgvector`.
- That means Supabase remains the simplest database target for the first deployment.

## Recommendation On The Database Layer

Keep Supabase for:

- Postgres relational data
- `pgvector` nearest-neighbor search
- Auth magic links
- signed upload URLs and artifact reads

Do **not** move the first deployment to D1 or Vectorize.

That would require redesigning a schema that currently depends on:

- Postgres extensions
- `vector(1536)` columns and HNSW indexes
- array types
- enum types
- RLS policies

The current matching query also performs vector ranking and relational filtering in the same SQL path, which fits Postgres much better than an immediate split across D1 + Vectorize.

## Backend Connectivity Plan

The backend should use two integration modes from Cloudflare Workers:

### Supabase Auth + Storage

- keep using `@supabase/supabase-js` from the Worker for:
  - `signInWithOtp`
  - `auth.getUser`
  - Storage signed uploads
  - Storage artifact reads

### Supabase Postgres

- connect the Worker to Supabase Postgres for repository queries
- prefer **Cloudflare Hyperdrive** for the Worker-to-Postgres connection path
- keep the existing repository abstraction so the rest of the app does not need a large rewrite
- validate whether the current `postgres` driver works cleanly through Hyperdrive in Workers; switch to `pg` only if needed

## Free-Tier Fit

This architecture is more free-tier-friendly than a full Cloudflare-native data migration, but there are still important limits:

- Cloudflare Pages is an easy fit for early traffic.
- Cloudflare Workers Free can handle a small alpha, but frequent polling will burn through request budgets quickly.
- Supabase Free is enough for a small alpha, including `pgvector`, but storage and index growth will eventually force an upgrade.

**Important practical note:** the current polling-heavy chat and status model is the biggest free-tier risk on the Cloudflare side, not the static frontend or Postgres itself.

## Setup Gaps

These are the concrete gaps between the current repo and the target deployment.

### 1. Worker runtime gap

- The API package is still started as a Node server.
- There is no `wrangler` config in the repo.
- There is no Worker entrypoint exporting `fetch`.
- There are no Cloudflare environment bindings or Worker deployment scripts.

### 2. Database connectivity gap

- The repository is written for direct Postgres access from a Node runtime.
- The Cloudflare deployment needs a Worker-compatible connection strategy for Supabase Postgres, ideally Hyperdrive.
- This needs to preserve complex matching queries, idempotency writes, and normal CRUD behavior.

### 3. Frontend origin gap

- The frontend currently assumes relative API requests.
- With the Worker on `api.contexted.app`, the frontend needs explicit production API origin handling unless Cloudflare routes are used to keep requests same-origin.

### 4. Referral/share origin gap

- Referral URLs are currently built from the API request origin.
- In production that would produce `api.contexted.app` links instead of `contexted.app` links unless a public app origin is configured.

### 5. CORS / routing gap

- If the web app stays on `contexted.app` and the API lives on `api.contexted.app`, the Worker needs a strict CORS allowlist.
- If you want to avoid CORS, you need a Cloudflare routing setup that makes the API appear same-origin to the browser.

### 6. Queue / async gap

- The app currently expects `QUEUE_DISPATCH_URL` and `QUEUE_DISPATCH_TOKEN`.
- There is no native Cloudflare Queue producer/consumer setup in the repo yet.
- There is no Cron Trigger config for scheduled drops yet.

### 7. Polling budget gap

- Chat polling is currently every `5s`.
- Processing polling is currently every `2s`.
- Reveal polling is currently every `5s`.
- Waiting room polling is currently every `15s`.

This is workable in development, but it is the biggest risk to staying on the Workers free tier in production.

### 8. Supabase environment gap

- Production needs a dedicated Supabase project.
- Staging needs a separate Supabase project.
- Auth redirect URLs need to be configured for production, staging, and any intentionally supported preview URLs.
- Service-role secrets must stay server-side only.

### 9. Deployment pipeline gap

- The repo has CI, but not deployment automation for Pages or Workers.
- There is no staging/prod environment promotion flow yet.
- There is no `wrangler` environment separation checked in yet.

### 10. Observability gap

- There is no deployment-time logging, tracing, or alerting setup for Worker runtime failures.
- There is no uptime check for the public frontend and API.

## Phase Plan

### Phase 1 — port the backend to Cloudflare Workers

- create Worker entrypoint for the Hono app
- add `wrangler.jsonc`
- add Cloudflare env typing and secrets handling
- keep the existing route contract intact
- keep Supabase as the data/auth/storage backend

### Phase 2 — keep Supabase as the database of record

- keep `pgvector` in Supabase Postgres
- keep the current SQL-heavy repository model
- validate that Hyperdrive supports the current query shape and driver choice

### Phase 3 — fix public origin handling

- add frontend API base URL handling or same-origin Cloudflare routing
- add `APP_PUBLIC_ORIGIN=https://contexted.app`
- make referral/share links resolve to the web domain, not the API domain
- add CORS only if the API stays on a separate subdomain

### Phase 4 — replace queue dispatch with Cloudflare-native background plumbing

- replace `QUEUE_DISPATCH_URL` / `QUEUE_DISPATCH_TOKEN`
- add Cloudflare Queue producer/consumer flow for ingestion
- add Cron Trigger for scheduled drops
- keep the database and artifact source of truth in Supabase

### Phase 5 — reduce request pressure

- increase polling intervals for low-priority screens
- add caching/ETag behavior where useful
- evaluate Durable Objects or WebSockets for chat if free-tier request pressure becomes too high

### Phase 6 — production hardening

- add Pages + Workers deployment automation
- add staging and production secrets
- add logging and health checks
- run full auth/upload/processing/matching/referral/chat smoke tests

## Infra Checklist

### Cloudflare

- create Pages project for `apps/web`
- attach `contexted.app`
- create Worker for API
- attach `api.contexted.app`
- configure staging domains
- set Worker secrets and environment variables
- add Cron Triggers
- add Queue bindings if ingestion is moved there
- add WAF and rate limits for public endpoints

### Supabase

- create production project
- create staging project
- apply migrations
- confirm `pgvector`-backed schema is healthy
- configure Auth site URLs and redirect URLs
- create storage bucket used by the app
- store anon and service-role keys in the Worker environment only where appropriate

## Initial Environment Variables

### Frontend

- `VITE_API_BASE_URL`

### Backend

- `APP_MODE=postgres`
- `APP_PUBLIC_ORIGIN`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `OPENAI_API_KEY`
- optional `ANTHROPIC_API_KEY`
- `LLM_PRIMARY`
- `INTERNAL_ADMIN_TOKEN`

### Background / Scheduling

- any Worker Queue binding names
- any Cron Trigger configuration

## Launch Recommendation

For the first real deployment, use:

- **Frontend:** Cloudflare Pages
- **Backend:** Cloudflare Workers
- **Database/Auth/Storage:** Supabase
- **Vector search:** Supabase `pgvector`

That gives you the architecture you want without forcing a risky data-platform rewrite before launch.

The main setup gaps to close first are:

1. Worker entry + `wrangler` config
2. Worker-to-Supabase Postgres connectivity
3. frontend/API origin handling
4. referral URL origin correctness
5. native Cloudflare background job setup
6. request-budget pressure from polling
