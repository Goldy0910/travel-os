-- ============================================================
-- User travel memory (1:1 with auth user — cross-trip prefs)
-- Distinct from conversation_memory (chat-scoped) and
-- trip_memory (trip-scoped). Do not merge those into this table.
-- ============================================================

create table if not exists public.user_travel_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorite_destinations jsonb not null default '[]'::jsonb,
  hotel_type text null,
  budget_range text null,
  travel_style text null,
  preferred_airlines jsonb not null default '[]'::jsonb,
  preferred_food jsonb not null default '[]'::jsonb,
  travel_pace text null,
  updated_at timestamptz not null default now(),
  constraint user_travel_memory_favorite_destinations_is_array
    check (jsonb_typeof(favorite_destinations) = 'array'),
  constraint user_travel_memory_preferred_airlines_is_array
    check (jsonb_typeof(preferred_airlines) = 'array'),
  constraint user_travel_memory_preferred_food_is_array
    check (jsonb_typeof(preferred_food) = 'array')
);

comment on table public.user_travel_memory is
  'Cross-trip user travel preferences. Isolated from trip_memory and conversation_memory.';

create or replace function public.set_user_travel_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_travel_memory_updated_at on public.user_travel_memory;

create trigger trg_user_travel_memory_updated_at
before update on public.user_travel_memory
for each row
execute function public.set_user_travel_memory_updated_at();

alter table public.user_travel_memory enable row level security;

drop policy if exists user_travel_memory_select_own on public.user_travel_memory;
drop policy if exists user_travel_memory_insert_own on public.user_travel_memory;
drop policy if exists user_travel_memory_update_own on public.user_travel_memory;
drop policy if exists user_travel_memory_delete_own on public.user_travel_memory;

create policy user_travel_memory_select_own on public.user_travel_memory
  for select using (user_id = auth.uid());

create policy user_travel_memory_insert_own on public.user_travel_memory
  for insert with check (user_id = auth.uid());

create policy user_travel_memory_update_own on public.user_travel_memory
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_travel_memory_delete_own on public.user_travel_memory
  for delete using (user_id = auth.uid());
