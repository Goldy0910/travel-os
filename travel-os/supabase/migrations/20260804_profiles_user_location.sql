-- User location on profiles for personalization (city-level for AI; coords internal).
-- Idempotent; existing RLS on profiles covers these columns.

alter table if exists public.profiles
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_city text,
  add column if not exists location_state text,
  add column if not exists location_country text,
  add column if not exists location_source text,
  add column if not exists location_enabled boolean default true,
  add column if not exists location_updated_at timestamptz;

comment on column public.profiles.location_city is
  'Resolved city label for the user current/home location (AI personalization).';
comment on column public.profiles.location_lat is
  'Internal GPS latitude — never expose in chat UI or AI replies.';
comment on column public.profiles.location_lng is
  'Internal GPS longitude — never expose in chat UI or AI replies.';
