-- Baseline members table for group trips (must run before 20260401_group_travel_membership.sql).
-- Requires public.trips to exist.

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid,
  email text,
  name text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
