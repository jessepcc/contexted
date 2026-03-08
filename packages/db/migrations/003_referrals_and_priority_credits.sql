create type referral_status as enum ('clicked','claimed','qualified','rewarded','ineligible');
create type priority_credit_status as enum ('available','consumed','expired');

alter table users
add column if not exists queue_entered_at timestamptz;

create table if not exists invite_codes (
  user_id uuid primary key references users(id) on delete cascade,
  code text unique not null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references users(id) on delete cascade,
  invitee_user_id uuid references users(id) on delete cascade,
  invite_code text not null references invite_codes(code) on delete cascade,
  status referral_status not null default 'clicked',
  ineligible_reason text,
  claimed_at timestamptz,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists referrals_invitee_unique_idx
on referrals (invitee_user_id)
where invitee_user_id is not null;

create index if not exists referrals_inviter_status_idx
on referrals (inviter_user_id, status, created_at desc);

create table if not exists priority_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_type text not null,
  referral_id uuid not null references referrals(id) on delete cascade,
  status priority_credit_status not null default 'available',
  available_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_in_drop_id uuid references drops(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists priority_credits_referral_user_unique_idx
on priority_credits (referral_id, user_id);

create unique index if not exists priority_credits_user_drop_unique_idx
on priority_credits (user_id, consumed_in_drop_id)
where consumed_in_drop_id is not null;

create index if not exists priority_credits_available_idx
on priority_credits (user_id, status, available_at)
where status = 'available';

create index if not exists users_waiting_queue_idx
on users (queue_entered_at, id)
where status = 'waiting' and deleted_at is null;

alter table invite_codes enable row level security;
alter table referrals enable row level security;
alter table priority_credits enable row level security;

alter table invite_codes force row level security;
alter table referrals force row level security;
alter table priority_credits force row level security;

create policy invite_codes_owner_rw on invite_codes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy referrals_inviter_read on referrals
  for select to authenticated
  using (
    inviter_user_id = (select auth.uid())
    or invitee_user_id = (select auth.uid())
  );

create policy referrals_invitee_insert on referrals
  for insert to authenticated
  with check (
    inviter_user_id <> (select auth.uid())
    and (
      invitee_user_id is null
      or invitee_user_id = (select auth.uid())
    )
  );

create policy priority_credits_owner_rw on priority_credits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
