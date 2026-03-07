# CONTEXT Implementation Technical Spec (Development-Ready)

## 0) Inputs and Process
- Source documents:
  - `PRD.md`
  - `docs/advisory-findings.md`
- Generated via 5+ rounds of adversarial multi-agent review:
  - Moderator/Principal Architect
  - Backend/Data
  - Security/Privacy
  - Product/Growth
  - Frontend/UX
- Objective: immediate implementation spec with explicit anti-overengineering and anti-underengineering boundaries.

## 1) Final Product Contract
- Asynchronous matchmaking app based on AI-memory-derived profiles.
- No long-term storage of raw upload files.
- Matches are delivered in scheduled drops.
- Unlock mechanism: `2 synergy points + 1 confession` (not 3x3).
- Anonymous polling-based chat opens only after both confessions.

## 2) Non-Negotiable Scope (MVP)
- ChatGPT + Claude memory upload support.
- Magic-link auth (email) as only auth method.
- Strict input sanity checks on all mutating endpoints (schema + semantic validation).
- Preference filters are mandatory before queue entry:
  - `gender_identity`
  - `attracted_to`
  - `age_min`, `age_max`
- Async ingestion + sanitization + embedding pipeline.
- Precomputed reveal artifacts in storage before notifications.
- Polling chat (no WebSockets in MVP).
- Reporting/abuse controls from day 1.
- Day-1 analytics required for kill metrics.
- One-time monetization only:
  - `Unhinged Mode ($1.99)`
  - `Friend Compatibility ($4.99)`

## 3) Explicit Out of Scope (Do Not Build Now)
- WebSocket/realtime infra.
- Native mobile apps.
- 3x3 unlock flow.
- Photo reveal milestone.
- Subscription billing.
- Wallet/Telegram auth.
- Text-paste ingestion fallback (unless upload completion <40%).
- Full “Brain Type” analytics pipeline.
- Gale-Shapley default matching before trigger threshold.

## 4) Architecture

### 4.1 Runtime Components
- Frontend: React + TanStack Router + Vite PWA on Cloudflare Pages.
- API/Edge: Cloudflare Worker for API endpoints and signed artifact access.
- DB/Auth/Storage: Supabase (Postgres + Auth + Storage).
- Queue/Orchestration: Cloudflare Workflows (durable multi-step execution) + Cloudflare Queues (burst buffering/fan-out). Native to Cloudflare, no external SaaS dependency.
  - Workflows: `step.do()` chains for upload pipeline and drop pipeline. Per-step retries (exponential/linear/constant). Unlimited wall-clock time; 5 min CPU/step (sufficient — steps are I/O-heavy: LLM calls, Supabase queries).
  - Queues: Absorbs upload spikes and provides fan-out for parallel LLM content generation during drops.
  - Cron: Workers Cron Triggers invoke Workflow instances for scheduled drops.
- AI:
  - Redaction + summary + vibe text: low-cost model tier.
  - Embeddings: `text-embedding-3-small`.
- Email: Resend.

### 4.2 Core Data Flow
1. Client requests upload presign.
2. Client uploads raw file to private encrypted staging bucket.
3. Client confirms upload completion (auth required).
4. Queue pipeline runs parse -> redact -> PII validate -> embed -> profile/vibe persist.
5. User enters waiting state.
6. Drop pipeline computes matches and generates pair content.
7. Precompute per-user reveal artifacts to storage.
8. Notifications sent in gated cohorts.
9. User opens reveal link, submits confession, unlocks chat.

## 5) Raw Upload Boundary (Security + Reliability Tie-Break, Final)

### 5.1 NRB-1 Policy
- Raw files are classified `R0` and may exist only in private encrypted staging storage.
- Raw content must never be stored in:
  - Postgres rows
  - Logs/traces/APM payload bodies
  - Analytics events
  - Queue payload bodies
- Signed upload URL TTL: `<= 5 minutes`.
- App-layer deletion on successful processing: target `<= 5 minutes`.
- Infrastructure lifecycle hard delete: `<= 60 minutes`.
- If retries exhaust and TTL expires: job fails and requires re-upload.

### 5.2 Enforceability (Launch Gate)
- Must pass before launch:
  - Sentinel raw string appears `0` times in DB/logs/traces/analytics.
  - Stale raw objects older than 60 min = `0`.
  - Non-worker principal storage reads denied.
  - Success path deletes raw objects within 5 minutes.
  - Crash/retry path still deletes all raw objects within 60 minutes.
- If any check fails, launch is no-go.

## 6) Data Model

### 6.1 Enums
```sql
create type user_status as enum ('waiting','processing','ready','matched','re_queued','blocked','quarantined','failed');
create type drop_status as enum ('scheduled','ingest_closed','matching','content_ready','published','notified','closed','paused','failed');
create type match_status as enum ('pending_confession','unlocked','expired','closed');
create type source_kind as enum ('chatgpt','claude','both');
```

### 6.2 Tables
```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  status user_status not null default 'waiting',
  created_at timestamptz not null default now(),
  last_active_at timestamptz,
  deleted_at timestamptz
);

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  source source_kind not null,
  sanitized_summary text not null,
  vibe_check_card text,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  pii_risk_score int not null default 0,
  retention_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table preferences (
  user_id uuid primary key references users(id) on delete cascade,
  gender_identity text not null,
  attracted_to text[] not null,
  age_min int not null default 18,
  age_max int not null default 99,
  check (age_min >= 18),
  check (age_max >= age_min)
);

create table profile_ingestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source source_kind not null,
  storage_bucket text not null,
  storage_key text not null unique,
  sha256 char(64) not null,
  size_bytes int not null,
  status text not null,
  error_code text,
  pii_risk_score int not null default 0,
  raw_mode text not null default 'ttl_object_storage',
  raw_delete_due_at timestamptz not null,
  raw_deleted_at timestamptz,
  raw_delete_attempts int not null default 0,
  raw_delete_last_error text,
  policy_version text not null default 'raw-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drops (
  id uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,
  status drop_status not null default 'scheduled',
  mode text not null default 'global',
  pool_size int,
  go_no_go_snapshot jsonb,
  failure_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table drop_memberships (
  drop_id uuid not null references drops(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  eligible boolean not null,
  reason text,
  candidate_count int not null default 0,
  paired_user_id uuid references users(id),
  score real,
  primary key (drop_id, user_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references drops(id) on delete cascade,
  user_a_id uuid not null references users(id),
  user_b_id uuid not null references users(id),
  status match_status not null default 'pending_confession',
  synergy_points jsonb not null,
  confession_prompt text not null,
  user_a_confession text,
  user_b_confession text,
  response_deadline timestamptz not null,
  unlocked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (user_a_id <> user_b_id)
);

create unique index matches_drop_pair_uq
on matches(drop_id, least(user_a_id,user_b_id), greatest(user_a_id,user_b_id));

create table reveal_tokens (
  token_hash text primary key,
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  artifact_path text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  reporter_id uuid not null references users(id),
  reported_id uuid not null references users(id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table match_feedback (
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table shared_vibe_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  share_token text unique not null,
  platform text,
  clicked boolean not null default false,
  created_at timestamptz not null default now()
);

create table job_runs (
  id bigserial primary key,
  job_name text not null,
  idempotency_key text not null,
  status text not null,
  attempts int not null default 0,
  last_error text,
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  unique (job_name, idempotency_key)
);

create table outbox_events (
  id bigserial primary key,
  event_type text not null,
  dedupe_key text not null,
  payload jsonb not null,
  status text not null,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_type, dedupe_key)
);

create table analytics_events (
  event_id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  anonymous_id text,
  user_id uuid,
  session_id text,
  drop_id uuid,
  match_id uuid,
  share_token text,
  source source_kind,
  device text,
  country text,
  timezone text,
  utm_source text,
  utm_campaign text,
  latency_ms int,
  error_code text,
  properties jsonb not null default '{}'::jsonb
);
```

### 6.3 Required Indexes
```sql
create index users_status_idx on users(status);
create index profiles_embedding_hnsw on profiles using hnsw (embedding vector_cosine_ops) with (m=16, ef_construction=128);
create index profiles_model_idx on profiles(embedding_model);
create index ingestions_user_sha_idx on profile_ingestions(user_id, sha256);
create index ingestions_status_idx on profile_ingestions(status, created_at desc);
create index ingestions_expiry_idx on profile_ingestions(raw_delete_due_at) where raw_deleted_at is null;
create index drops_status_sched_idx on drops(status, scheduled_at);
create index matches_user_a_idx on matches(user_a_id, created_at desc);
create index matches_user_b_idx on matches(user_b_id, created_at desc);
create index messages_match_created_idx on messages(match_id, created_at);
create index outbox_status_retry_idx on outbox_events(status, next_attempt_at);
create index jobs_status_retry_idx on job_runs(status, next_retry_at);
```

## 7) API Contracts (MVP)

### 7.1 Auth and Bootstrap
- `POST /v1/auth/magic-link`
  - Request: `{ email, redirect_to }`
  - Response: `{ sent: true }`
- `GET /v1/bootstrap` (auth)
  - Response includes:
    - `server_now`
    - `phase`: `upload|processing|waiting|matched_locked|chat_unlocked|expired`
    - `drop`
    - `intake`
    - `match`

### 7.2 Intake
- `POST /v1/uploads/init`
  - Request: `{ source, file_name, file_size, sha256 }`
  - Response: `{ ingestion_id, upload_url, upload_headers, expires_at, max_bytes }`
- `POST /v1/uploads/complete` (auth, idempotent)
  - Headers: `Idempotency-Key`
  - Request: `{ ingestion_id }`
  - Response: `{ state: "queued", job_id }`
- `GET /v1/ingest/jobs/:job_id` (auth)
  - Response: `{ state, progress, error_code, retryable, poll_after_ms }`

### 7.3 Matching and Reveal
- `POST /v1/preferences` (auth)
- `POST /v1/waitlist/enroll` (auth)
- `GET /v1/matches/current` (auth)
  - Response: `{ match_id, state, synergy_points[2], confession_prompt, my_confession, partner_confession, deadline_at, chat_expires_at, version, poll_after_ms }`
- `POST /v1/matches/:id/confession` (auth, idempotent)
  - Headers: `Idempotency-Key`
  - Request: `{ answer, expected_version }`
  - Response: `{ state, version }`
- `GET /r/:token` (signed token)
  - Returns reveal artifact via worker after token validation.

### 7.4 Chat
- `GET /v1/matches/:id/messages?cursor=...` (auth, supports `If-None-Match`)
  - Response: `{ items, next_cursor, poll_after_ms, chat_expires_at }` or `304`
- `POST /v1/matches/:id/messages` (auth, idempotent via `client_message_id`)
- `POST /v1/matches/:id/read` (auth)

### 7.5 Safety, Growth, and Feedback
- `POST /v1/reports` (auth)
- `POST /v1/matches/:id/feedback` (auth)
- `POST /v1/vibe-share/:share_token/click` (no auth)

### 7.6 Input Sanity Contract (All Mutating APIs)
- Reject unknown fields in JSON bodies (`additionalProperties: false`).
- Reject control characters in user text except newline/tab.
- Trim leading/trailing whitespace on all text inputs before validation.
- Enforce normalized UTF-8 and max payload size `128KB` (except upload binary path).
- Use strict allowlists and length bounds:
  - `email`: normalized lowercase, RFC-valid, max 254 chars.
  - `source`: `chatgpt|claude|both` only.
  - `file_name`: max 255 chars, no path separators.
  - `sha256`: lowercase hex, length 64.
  - `gender_identity`: `M|F|NB`.
  - `attracted_to`: non-empty subset of `M|F|NB`.
  - `age_min`: 18..99; `age_max`: `age_min..99`.
  - `confession answer`: 1..600 chars.
  - `message body`: 1..2000 chars.
  - `report reason`: 1..500 chars.
  - `rating`: integer 1..5.
- Semantic checks:
  - `POST /v1/matches/:id/messages` only when `match.status=unlocked` and before `expires_at`.
  - `POST /v1/matches/:id/confession` only before `response_deadline`.
  - `POST /v1/uploads/complete` only for same-user `ingestion_id` and unexpired upload session.
- Validation error response standard:
  - HTTP `422` + `{ code, field, message }`
  - `code` enum: `INVALID_FORMAT|OUT_OF_RANGE|DISALLOWED_VALUE|PAYLOAD_TOO_LARGE|STATE_CONFLICT`

## 8) Client Spec

### 8.1 Routes
- `/`
- `/auth/verify`
- `/app`
- `/app/upload`
- `/app/processing`
- `/app/waiting`
- `/app/reveal`
- `/app/chat`
- `/app/expired`
- `/app/error`

### 8.2 State Machine
```text
unauth -> upload -> processing -> waiting -> matched_locked -> chat_unlocked -> expired
```
- Server-authoritative transitions only.
- Version mismatch on confession returns `409` with latest state.

### 8.3 Polling Policy
- Processing: server-driven (`poll_after_ms`, default 2000ms).
- Reveal locked: 5s foreground, 30s background.
- Chat: 5s foreground, 30s background, 60s degraded.
- All polling uses jitter and backoff.

### 8.4 Performance and A11y Constraints
- LCP p75 `< 2.5s` on 4G.
- INP p75 `< 200ms`.
- CLS `< 0.1`.
- App shell JS `< 220KB` gzip.
- WCAG 2.2 AA baseline.
- Keyboard-complete flow and `aria-live` status updates.

## 9) Matching and Drop Operations

### 9.1 Matching Algorithm (MVP)
- Candidate generation: pgvector top-K (`K=20`) filtered by preferences and exclusions.
- Pairing: deterministic dedup pairing for early drops.
- LLM used only for finalized pair content (not candidate reranking at scale).
- Gale-Shapley deferred behind trigger.

### 9.2 Drop State Machine
```text
scheduled -> ingest_closed -> matching -> content_ready -> published -> notified -> closed
```
- Pausable states: `matching|content_ready|published|notified`.

### 9.3 Go / No-Go Checklist
- All must pass:
  - Eligible processed `>= 99.5%`
  - Duplicate/preference-violating pairs `= 0`
  - Pair content generated `>= 98%`
  - Artifact fetch sample success `>= 99.9%`
  - Raw objects older than TTL `= 0`
  - Magic-link canary success `>= 98%`
  - Synthetic reveal `p95 < 800ms`, `5xx < 0.5%`

### 9.4 Send and Rollback
- Cohort send: 10% every 3 minutes with health checks.
- Auto-pause triggers:
  - Reveal `5xx > 1%` for 5 minutes
  - Confirmed incident > 0.1% in sent cohort
- Rollback:
  - If `<30%` sent: invalidate links, rerun, resend.
  - If `>=30%` sent: keep existing pairs, patch and resume.

## 10) Security and Compliance Baseline

### 10.1 RLS
- Required on: `profiles`, `preferences`, `matches`, `messages`, `reports`, `match_feedback`, `shared_vibe_checks`.
- Service-role keys only in backend workers.

### 10.2 Abuse Controls
- Report + block flows required.
- Rate limits:
  - Login: `5/hour/account`, `20/hour/IP`
  - Message: `30 per 5 min per match`
  - Reports: `5/day/user`
- Automated keyword-based risk flagging for severe abuse/self-harm signals.

### 10.3 Legal Copy Constraints
- Allowed:
  - “We do not retain your raw upload after processing.”
  - “We store only redacted outputs needed to operate the service.”
- Forbidden:
  - “We store zero data.”
  - “We are fully anonymous/untraceable.”
  - “We literally can’t access your data.”
  - “Guaranteed GDPR compliant.”

### 10.4 User Input Sanity Enforcement
- Implement shared validator middleware for all write endpoints.
- Validation order is mandatory:
  1. Authentication/authorization.
  2. JSON schema + type checks.
  3. Per-field sanitization and bounds checks.
  4. Business-state checks (deadlines, match state, ownership).
  5. Persistence.
- Validation failures must never trigger LLM calls, embedding calls, or queue enqueue.
- Store only validated, normalized values.
- Log only validation metadata (`endpoint`, `field`, `error_code`), never raw rejected content.

### 10.5 Destructive Command Guard for Operator Safety
- Add `destructive_command_guard` to developer and CI environments:
  - Repo: `https://github.com/Dicklesworthstone/destructive_command_guard`
  - Install (reference): ``curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/destructive_command_guard/main/install.sh?$(date +%s)" | bash -s -- --easy-mode``
- Purpose:
  - Block destructive shell/database/cloud commands before execution in AI-agent and automation contexts.
  - Reduce accidental data loss during migrations, infra ops, and release scripts.
- Baseline policy:
  - Enable core git/filesystem protections.
  - Enable PostgreSQL and Cloudflare-related protection packs for this stack.
  - Run guard checks in CI scan mode on automation scripts and docs containing command blocks.
- Minimum rollout requirements:
  - Local dev setup documented in onboarding.
  - CI fails if guard detects blocked high-risk command patterns in changed automation paths.
  - Security owner reviews allowlist exceptions.

## 11) Retention Policy
- Raw uploads: deleted immediately after processing; hard delete `<=60m`.
- Redacted summaries + embeddings: `180 days` since last activity.
- Match metadata: `12 months`.
- Message content: `30 days` after chat close/timeout.
- Event-level analytics: `90 days`.
- Aggregated analytics: `13 months`.
- User deletion SLA: full purge `<=7 days` (backup propagation max 14 days).

## 12) Observability and Kill Metrics

### 12.1 Required Events
- `landing_view`
- `upload_start`
- `upload_preflight_failed`
- `upload_complete`
- `teaser_generated`
- `auth_magiclink_sent`
- `auth_verified`
- `preferences_completed`
- `queue_joined`
- `vibe_generated`
- `share_clicked`
- `share_completed`
- `referral_visit`
- `match_assigned`
- `match_opened`
- `confession_submitted`
- `chat_unlocked`
- `first_message_sent`
- `purchase_completed`
- `report_submitted`
- `d1_return`
- `d7_return`

### 12.2 Kill Metrics Definitions
- `upload_completion_rate = unique(upload_complete)/unique(upload_start)`; fail `< 40%`.
- `vibe_share_rate = unique(share_completed)/unique(vibe_generated)`; fail `< 15%`.
- `match_open_rate = unique(match_opened)/unique(match_assigned)`; fail `< 30%`.
- `chat_unlock_rate = unique(chat_unlocked)/unique(match_opened)`; warn `< 45%`.
- `d7_retention = cohort(d7_return)/cohort(upload_complete)`; fail `< 10%`.
- `gender_skew = max(group_count)/total`; fail `> 75%`.
- `monthly_net_burn = infra + llm + email - revenue`; fail if `> $500` by month 2 and revenue = 0.

## 13) Runtime Configuration (Initial Defaults)
```env
MAX_UPLOAD_MB=64
SIGNED_UPLOAD_TTL_SEC=300
RAW_POLICY_VERSION=raw-v1
RAW_MODE_DEFAULT=ttl_object_storage
RAW_HARD_TTL_MINUTES=60
RAW_DELETE_ON_SUCCESS=true
RAW_LOGGING_MODE=METADATA_ONLY
RAW_ENABLE_BREAK_GLASS_RAM=false
INGEST_RETRY_MAX=5
EMBEDDING_MODEL=text-embedding-3-small
DROP_PUBLISH_ENABLED=true
DROP_NOTIFY_ENABLED=true
LLM_CONTENT_ENABLED=true
CHAT_POLL_FOREGROUND_SEC=5
CHAT_POLL_BACKGROUND_SEC=30
SUPAVISOR_MODE=transaction
# Operator safety
DCG_REPO=https://github.com/Dicklesworthstone/destructive_command_guard
DCG_ENABLED=true
```

## 14) Final Decision Matrix
- `Decide now`: all sections above.
- `Defer`: out-of-scope list.
- `Reject`:
  - RAM-only mandate for all ingestion.
  - Absolute privacy claims that exceed system guarantees.
  - Un-gated all-at-once drop notifications.
