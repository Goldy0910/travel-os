-- Run once in Supabase Dashboard → SQL Editor if "Continue Planning" reports
-- missing table public.trip_master_files.
-- Combines migrations 20260516 + 20260517.

-- ========== trip_master_files ==========
create table if not exists public.trip_master_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid unique references public.trips (id) on delete set null,
  version integer not null default 1,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_master_files_user_id_idx
  on public.trip_master_files (user_id, updated_at desc);

create index if not exists trip_master_files_trip_id_idx
  on public.trip_master_files (trip_id)
  where trip_id is not null;

alter table public.trip_master_files enable row level security;

drop policy if exists trip_master_files_select_own on public.trip_master_files;
create policy trip_master_files_select_own on public.trip_master_files
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists trip_master_files_insert_own on public.trip_master_files;
create policy trip_master_files_insert_own on public.trip_master_files
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists trip_master_files_update_own on public.trip_master_files;
create policy trip_master_files_update_own on public.trip_master_files
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists trip_master_files_delete_own on public.trip_master_files;
create policy trip_master_files_delete_own on public.trip_master_files
  for delete to authenticated
  using (user_id = auth.uid());

-- ========== trip_public_shares (optional, for share links) ==========
create table if not exists public.trip_public_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  master_trip_file_id uuid not null references public.trip_master_files (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists trip_public_shares_one_active_per_master_idx
  on public.trip_public_shares (master_trip_file_id)
  where revoked_at is null;

create index if not exists trip_public_shares_token_idx
  on public.trip_public_shares (token)
  where revoked_at is null;

alter table public.trip_public_shares enable row level security;

drop policy if exists trip_public_shares_select_own on public.trip_public_shares;
create policy trip_public_shares_select_own on public.trip_public_shares
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists trip_public_shares_insert_own on public.trip_public_shares;
create policy trip_public_shares_insert_own on public.trip_public_shares
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists trip_public_shares_update_own on public.trip_public_shares;
create policy trip_public_shares_update_own on public.trip_public_shares
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists trip_public_shares_delete_own on public.trip_public_shares;
create policy trip_public_shares_delete_own on public.trip_public_shares
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.get_trip_share_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_token, ''));
  v_snapshot jsonb;
begin
  if length(v_trim) < 16 then
    return jsonb_build_object('found', false);
  end if;

  select s.snapshot
  into v_snapshot
  from public.trip_public_shares s
  where s.token = v_trim
    and s.revoked_at is null
  limit 1;

  if v_snapshot is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'snapshot', v_snapshot);
end;
$$;

revoke all on function public.get_trip_share_by_token(text) from public;
grant execute on function public.get_trip_share_by_token(text) to anon;
grant execute on function public.get_trip_share_by_token(text) to authenticated;

-- ========== itinerary hydration metadata (20260518) ==========
alter table if exists public.itinerary_items
  add column if not exists google_place_id text,
  add column if not exists notes text,
  add column if not exists category text;

create index if not exists itinerary_items_trip_google_place_idx
  on public.itinerary_items (trip_id)
  where google_place_id is not null;
