-- Public trip share links: sanitized snapshots only (no raw master file exposure).
-- Additive — does not alter trip_master_files or trips.

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

comment on table public.trip_public_shares is
  'TravelTill99 public share snapshots — token-gated via RPC; never expose user_id or trip_id.';

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

-- Token lookup only — returns sanitized snapshot, never internal ids.
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
