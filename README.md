# Contexted MVP

Production-oriented MVP scaffold for Contexted, implemented as a TypeScript workspace. The current MVP includes intake, scheduled drops, reveal/chat flows, and a private-invite acquisition loop that rewards successful referred signups with earlier consideration in future drops.

## Workspace

- `apps/api-worker`: Hono API implementing MVP endpoint contracts.
- `apps/web`: React + TanStack Router PWA routes and client state machine.
- `packages/shared`: Shared schemas, enums, matching logic, sanitization.
- `packages/db`: Supabase/Postgres schema migration and RLS policies.
- `docs`: Focused product and implementation notes.

## Quick Start

1. `cp .env.example .env`
2. `npm install`
3. `npm run test:coverage`

Use `APP_MODE=memory` for local API smoke tests. For staging/production mode, configure Supabase, Postgres, queue dispatch, and AI provider keys from `.env.example`.

## Database

- Apply all migrations in order:
  - `packages/db/migrations/001_init.sql`
  - `packages/db/migrations/002_match_text_and_history_idx.sql`
  - `packages/db/migrations/003_referrals_and_priority_credits.sql`
- The schema includes RLS on sensitive user-facing tables, queue/matching indexes, and invite/referral tables for the private-invite loop.

## Private Invites

- Authenticated users can fetch their invite state with `GET /v1/referrals/me`.
- Invite recipients can claim an invite with `POST /v1/referrals/claim`.
- Invite-link opens can be tracked with `POST /v1/referrals/:invite_code/click`.
- Qualification happens when a claimed invitee successfully reaches `/v1/waitlist/enroll`.
- A successful referral grants one priority credit to the inviter and one to the invitee, capped to two landed referrals per inviter in the current alpha.
- Matching remains compatibility-first; priority credits only affect first-pass queue ordering and are consumed only after a drop publishes successfully.

For the full flow, API contract, queue semantics, and frontend auth handoff behavior, see `docs/private-invites.md`.

## Runtime Integrations

- Auth: Supabase magic link (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- Storage: Supabase signed uploads and artifact reads (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`).
- Queue: HTTP dispatcher endpoint for Cloudflare Queue fan-out (`QUEUE_DISPATCH_URL`, `QUEUE_DISPATCH_TOKEN`).
- AI: OpenAI embeddings plus OpenAI/Anthropic LLM fallback (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_PRIMARY`).
- Matching: configurable top-K candidate retrieval plus protected internal drop trigger (`MATCH_TOP_K`, `INTERNAL_ADMIN_TOKEN`).

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
