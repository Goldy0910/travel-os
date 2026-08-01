-- ============================================================
-- Trip memory (1:1 with trip — preferences shared by members)
-- Distinct from conversation_memory (chat-scoped).
-- ============================================================

create table if not exists public.trip_memory (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  budget text null,
  hotel_preference text null,
  food_preference text null,
  flight_preference text null,
  interests jsonb not null default '[]'::jsonb,
  visited_places jsonb not null default '[]'::jsonb,
  packing_preferences jsonb not null default '[]'::jsonb,
  emergency_contacts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint trip_memory_interests_is_array
    check (jsonb_typeof(interests) = 'array'),
  constraint trip_memory_visited_places_is_array
    check (jsonb_typeof(visited_places) = 'array'),
  constraint trip_memory_packing_preferences_is_array
    check (jsonb_typeof(packing_preferences) = 'array'),
  constraint trip_memory_emergency_contacts_is_array
    check (jsonb_typeof(emergency_contacts) = 'array')
);

comment on table public.trip_memory is
  'Trip-scoped preference memory (budget, lodging, food, flights, interests, packing, emergency contacts).';

create or replace function public.set_trip_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_trip_memory_updated_at on public.trip_memory;

create trigger trg_trip_memory_updated_at
before update on public.trip_memory
for each row
execute function public.set_trip_memory_updated_at();

alter table public.trip_memory enable row level security;

drop policy if exists trip_memory_select_member on public.trip_memory;
drop policy if exists trip_memory_insert_member on public.trip_memory;
drop policy if exists trip_memory_update_member on public.trip_memory;
drop policy if exists trip_memory_delete_member on public.trip_memory;

create policy trip_memory_select_member on public.trip_memory
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy trip_memory_insert_member on public.trip_memory
  for insert with check (public.is_trip_member(trip_id, auth.uid()));

create policy trip_memory_update_member on public.trip_memory
  for update using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy trip_memory_delete_member on public.trip_memory
  for delete using (public.is_trip_member(trip_id, auth.uid()));
