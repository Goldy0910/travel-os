-- ============================================================
-- Saved places (user-owned wishlist of Google Places)
-- ============================================================

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  name text not null,
  address text null,
  category text null,
  photo_name text null,
  photo_url text null,
  rating numeric null,
  maps_url text null,
  lat double precision null,
  lng double precision null,
  destination_id text null,
  created_at timestamptz not null default now(),
  constraint saved_places_place_id_len check (char_length(place_id) between 1 and 256),
  constraint saved_places_name_len check (char_length(name) between 1 and 200),
  unique (user_id, place_id)
);

create index if not exists saved_places_user_created_idx
  on public.saved_places (user_id, created_at desc);

comment on table public.saved_places is
  'Places a traveler saved (heart) for later. Distinct from destination_interest FAVORITE analytics.';

alter table public.saved_places enable row level security;

drop policy if exists saved_places_select_own on public.saved_places;
drop policy if exists saved_places_insert_own on public.saved_places;
drop policy if exists saved_places_update_own on public.saved_places;
drop policy if exists saved_places_delete_own on public.saved_places;

create policy saved_places_select_own on public.saved_places
  for select using (user_id = auth.uid());

create policy saved_places_insert_own on public.saved_places
  for insert with check (user_id = auth.uid());

create policy saved_places_update_own on public.saved_places
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy saved_places_delete_own on public.saved_places
  for delete using (user_id = auth.uid());
