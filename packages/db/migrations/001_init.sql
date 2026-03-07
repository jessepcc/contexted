create extension if not exists citext;
create extension if not exists pgcrypto;
create extension if not exists vector;

create type user_status as enum ('waiting','processing','ready','matched','re_queued','blocked','quarantined','failed');
create type drop_status as enum ('scheduled','ingest_closed','matching','content_ready','published','notified','closed','paused','failed');
create type match_status as enum ('pending_confession','unlocked','expired','closed');
create type source_kind as enum ('chatgpt','claude','both');

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
  upload_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ingest_jobs (
  id uuid primary key,
  ingestion_id uuid not null references profile_ingestions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  state text not null,
  progress int not null default 0,
  error_code text,
  retryable boolean not null default true,
  poll_after_ms int not null default 2000,
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
  version int not null default 0,
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
  client_message_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz
);

create unique index messages_match_sender_client_uq
  on messages(match_id, sender_id, client_message_id);

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

create table idempotency_keys (
  scope text not null,
  user_id uuid not null references users(id) on delete cascade,
  idempotency_key text not null,
  status_code int not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (scope, user_id, idempotency_key)
);

create index users_status_idx on users(status);
create index profiles_embedding_hnsw on profiles using hnsw (embedding vector_cosine_ops) with (m=16, ef_construction=128);
create index profiles_model_idx on profiles(embedding_model);
create index ingestions_user_sha_idx on profile_ingestions(user_id, sha256);
create index ingestions_status_idx on profile_ingestions(status, created_at desc);
create index ingestions_expiry_idx on profile_ingestions(raw_delete_due_at) where raw_deleted_at is null;
create index ingest_jobs_user_state_idx on ingest_jobs(user_id, state, updated_at desc);
create index drops_status_sched_idx on drops(status, scheduled_at);
create index matches_user_a_idx on matches(user_a_id, created_at desc);
create index matches_user_b_idx on matches(user_b_id, created_at desc);
create index messages_match_created_idx on messages(match_id, created_at);
create index reports_reporter_created_idx on reports(reporter_id, created_at desc);
create index outbox_status_retry_idx on outbox_events(status, next_attempt_at);
create index jobs_status_retry_idx on job_runs(status, next_retry_at);

alter table profiles enable row level security;
alter table preferences enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table match_feedback enable row level security;
alter table shared_vibe_checks enable row level security;

alter table profiles force row level security;
alter table preferences force row level security;
alter table matches force row level security;
alter table messages force row level security;
alter table reports force row level security;
alter table match_feedback force row level security;
alter table shared_vibe_checks force row level security;

create policy profiles_owner_rw on profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy preferences_owner_rw on preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy matches_participant_read on matches
  for select to authenticated
  using (
    user_a_id = (select auth.uid())
    or user_b_id = (select auth.uid())
  );

create policy messages_participant_read on messages
  for select to authenticated
  using (
    exists (
      select 1 from matches m
      where m.id = messages.match_id
        and (m.user_a_id = (select auth.uid()) or m.user_b_id = (select auth.uid()))
    )
  );

create policy messages_sender_insert on messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()));

create policy reports_reporter_insert on reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy reports_reporter_read on reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy feedback_owner_rw on match_feedback
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy share_owner_rw on shared_vibe_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
