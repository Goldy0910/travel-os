-- Master Trip File: persistent decision + itinerary snapshot per user/trip.
-- Additive only — does not alter public.trips columns or existing tables.

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

comment on table public.trip_master_files is
  'TravelTill99 Master Trip File — recommendation, preferences, itinerary snapshot, refinement history.';

comment on column public.trip_master_files.data is
  'JSON document (schemaVersion 1). See lib/master-trip-file/types.ts';

comment on column public.trip_master_files.version is
  'Optimistic concurrency version; increment on each successful update.';

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
