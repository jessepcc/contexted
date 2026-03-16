# Contributing to Contexted

Thanks for your interest in contributing! This guide covers what you need to get started.

## Prerequisites

- **Node.js >= 20**
- **npm** (comes with Node)

No external services needed for local development — the API runs in-memory mode by default.

## Setup

```bash
git clone https://github.com/jessepcc/contexted.git
cd contexted
npm install
```

## Running Locally

```bash
# Start the API (in-memory mode, no external deps)
cd apps/api-worker && npm run dev

# Start the web app (in a separate terminal)
cd apps/web && npm run dev
```

The web dev server proxies `/v1` and `/r` routes to the API automatically. `npm run dev` no longer requires a local `.env` file for memory mode.

In memory mode, requesting a magic link does not send email. The login screen will show a one-device local sign-in link instead.

## Running Tests

```bash
# All tests across workspaces
npm run test

# With workspace coverage reports
npm run test:coverage

# Single test file
cd apps/api-worker && npx vitest run test/app.test.ts
```

## Before Submitting a PR

1. **Typecheck**: `npm run typecheck` must pass
2. **Tests**: `npm run test:coverage` must pass
3. **Safety scan**: `npm run safety:scan` must pass — this checks for destructive command patterns in scripts and docs
4. **No lint tooling yet** — lint scripts are currently no-ops

## Project Structure

```
apps/api-worker/   — Hono REST API (Cloudflare Workers / Node locally)
apps/web/          — React 19 SPA (TanStack Router, Vite)
packages/shared/   — Zod schemas, enums, state machine, matching algorithms
packages/db/       — SQL migrations (applied to Supabase)
```

## Key Conventions

- **Zod for all validation** — schemas live in `packages/shared`, used by both API and frontend
- **Postgres driver**: `postgres` (porsager/postgres), not `pg` — uses tagged template literals
- **TypeScript strict mode** everywhere
- **Shared package is the source of truth** for API contracts, business enums, and lifecycle rules

## Running with Supabase (Optional)

For the full matching pipeline (embeddings, drops, chat), you'll need a Supabase project, an OpenAI API key, and a local `.env` copied from `.env.example`. The local Node runtime falls back to in-process ingestion if queue env vars are unset, so pasted-memory intake still works without separate queue infra. See the README for details.

## Data Handling Expectations

- Treat the landing flow as a reviewed-excerpt flow, not a full-memory dump flow.
- Automatic redaction is intentionally limited and mostly contact-shaped.
- Remove names, employers, exact locations, family details, credentials, and secrets before submitting text during local or production testing.

## Community Docs

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
