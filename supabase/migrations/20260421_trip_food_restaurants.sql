-- Saved restaurants and group votes (Food tab)

create table if not exists public.trip_saved_restaurants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  saved_by uuid not null,
  place_id text not null,
  name text not null,
  address text,
  rating numeric,
  maps_url text,
  created_at timestamptz not null default now(),
  unique (trip_id, place_id)
);

create index if not exists trip_saved_restaurants_trip_idx
  on public.trip_saved_restaurants (trip_id);

create table if not exists public.trip_restaurant_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id text not null,
  user_id uuid not null,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  unique (trip_id, place_id, user_id)
);

create index if not exists trip_restaurant_votes_trip_idx
  on public.trip_restaurant_votes (trip_id);

alter table public.trip_saved_restaurants enable row level security;
alter table public.trip_restaurant_votes enable row level security;

drop policy if exists trip_saved_restaurants_select on public.trip_saved_restaurants;
create policy trip_saved_restaurants_select on public.trip_saved_restaurants
  for select using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists trip_saved_restaurants_insert on public.trip_saved_restaurants;
create policy trip_saved_restaurants_insert on public.trip_saved_restaurants
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and saved_by = auth.uid()
  );

drop policy if exists trip_saved_restaurants_delete on public.trip_saved_restaurants;
create policy trip_saved_restaurants_delete on public.trip_saved_restaurants
  for delete using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists trip_restaurant_votes_select on public.trip_restaurant_votes;
create policy trip_restaurant_votes_select on public.trip_restaurant_votes
  for select using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists trip_restaurant_votes_insert on public.trip_restaurant_votes;
create policy trip_restaurant_votes_insert on public.trip_restaurant_votes
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists trip_restaurant_votes_update on public.trip_restaurant_votes;
create policy trip_restaurant_votes_update on public.trip_restaurant_votes
  for update using (public.is_trip_member(trip_id, auth.uid()) and user_id = auth.uid())
  with check (public.is_trip_member(trip_id, auth.uid()) and user_id = auth.uid());

drop policy if exists trip_restaurant_votes_delete on public.trip_restaurant_votes;
create policy trip_restaurant_votes_delete on public.trip_restaurant_votes
  for delete using (public.is_trip_member(trip_id, auth.uid()) and user_id = auth.uid());
