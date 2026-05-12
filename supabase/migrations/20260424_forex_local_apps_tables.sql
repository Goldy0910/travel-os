-- Optional profile fields used by travel tools (kept nullable/optional)
alter table public.profiles
  add column if not exists passport_country text,
  add column if not exists nationality text;

-- Persisted forex transactions (server-backed alternative to localStorage)
create table if not exists public.forex_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  inr_amount numeric(12,2) not null check (inr_amount >= 0),
  exchange_rate numeric(12,6) not null check (exchange_rate > 0),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists forex_transactions_user_idx
  on public.forex_transactions (user_id, created_at desc);

create index if not exists forex_transactions_trip_idx
  on public.forex_transactions (trip_id, created_at desc);

alter table public.forex_transactions enable row level security;

drop policy if exists forex_transactions_select_own on public.forex_transactions;
create policy forex_transactions_select_own
  on public.forex_transactions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists forex_transactions_insert_own on public.forex_transactions;
create policy forex_transactions_insert_own
  on public.forex_transactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists forex_transactions_update_own on public.forex_transactions;
create policy forex_transactions_update_own
  on public.forex_transactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists forex_transactions_delete_own on public.forex_transactions;
create policy forex_transactions_delete_own
  on public.forex_transactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Local apps per-user ratings/feedback for future ranking/community features
create table if not exists public.local_apps_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city_key text not null,
  app_id text not null,
  rating smallint not null check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, city_key, app_id)
);

create index if not exists local_apps_feedback_user_idx
  on public.local_apps_feedback (user_id, updated_at desc);

create index if not exists local_apps_feedback_city_idx
  on public.local_apps_feedback (city_key, app_id);

create or replace function public.set_local_apps_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_local_apps_feedback_updated_at on public.local_apps_feedback;
create trigger trg_local_apps_feedback_updated_at
  before update on public.local_apps_feedback
  for each row execute procedure public.set_local_apps_feedback_updated_at();

alter table public.local_apps_feedback enable row level security;

drop policy if exists local_apps_feedback_select_own on public.local_apps_feedback;
create policy local_apps_feedback_select_own
  on public.local_apps_feedback
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists local_apps_feedback_insert_own on public.local_apps_feedback;
create policy local_apps_feedback_insert_own
  on public.local_apps_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists local_apps_feedback_update_own on public.local_apps_feedback;
create policy local_apps_feedback_update_own
  on public.local_apps_feedback
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists local_apps_feedback_delete_own on public.local_apps_feedback;
create policy local_apps_feedback_delete_own
  on public.local_apps_feedback
  for delete
  to authenticated
  using (user_id = auth.uid());
