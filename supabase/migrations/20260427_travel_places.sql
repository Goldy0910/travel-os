-- Curated destinations shown in create-trip search (expand via inserts / migrations).

create table if not exists public.travel_places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  primary_label text not null,
  subtitle text,
  visa_note text,
  tags text[] not null default '{}'::text[],
  icon_key text not null,
  sort_order int not null,
  canonical_location text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists travel_places_sort_order_idx on public.travel_places (sort_order);
create index if not exists travel_places_slug_idx on public.travel_places (slug);

alter table public.travel_places enable row level security;

drop policy if exists travel_places_select_authenticated on public.travel_places;
create policy travel_places_select_authenticated on public.travel_places
  for select to authenticated using (true);

insert into public.travel_places (slug, primary_label, subtitle, visa_note, tags, icon_key, sort_order, canonical_location)
values
  ('dubai-uae', 'Dubai', 'UAE', 'Visa on arrival', array['Shopping','Beach']::text[], 'shopping', 1, 'Dubai, United Arab Emirates'),
  ('thailand', 'Thailand', 'Bangkok · Phuket · Chiang Mai', 'Visa on arrival', array['Budget-friendly','Beach','Culture']::text[], 'beach', 2, 'Thailand'),
  ('singapore', 'Singapore', 'City-state', 'Visa on arrival', array['Shopping','Culture']::text[], 'city', 3, 'Singapore, Singapore'),
  ('maldives', 'Maldives', null, 'Visa on arrival', array['Beach','Nature']::text[], 'island', 4, 'Maldives'),
  ('malaysia', 'Malaysia', 'Kuala Lumpur · Langkawi', 'Visa on arrival', array['Budget-friendly','Beach','Culture']::text[], 'beach', 5, 'Malaysia'),
  ('sri-lanka', 'Sri Lanka', null, 'Visa on arrival', array['Budget-friendly','Culture','Nature']::text[], 'heritage', 6, 'Sri Lanka'),
  ('indonesia', 'Indonesia', 'Bali · Jakarta · Lombok', 'Visa on arrival', array['Budget-friendly','Beach','Culture']::text[], 'island', 7, 'Indonesia'),
  ('nepal', 'Nepal', null, 'Visa on arrival', array['Budget-friendly','Nature']::text[], 'nature', 8, 'Nepal'),
  ('vietnam', 'Vietnam', 'Hanoi · Ho Chi Minh · Da Nang', 'Visa on arrival', array['Budget-friendly','Culture','Nature']::text[], 'culture', 9, 'Vietnam'),
  ('turkey', 'Turkey', 'Istanbul · Cappadocia', null, array['Culture','Nature','Shopping']::text[], 'culture', 10, 'Turkey'),
  ('switzerland', 'Switzerland', null, null, array['Nature','Culture']::text[], 'nature', 11, 'Switzerland'),
  ('france', 'France', 'Paris · Nice · Lyon', null, array['Culture','Shopping']::text[], 'culture', 12, 'France'),
  ('italy', 'Italy', 'Rome · Venice · Milan', null, array['Culture','Shopping']::text[], 'culture', 13, 'Italy'),
  ('united-kingdom', 'United Kingdom', 'London · Edinburgh', null, array['Culture','Shopping']::text[], 'culture', 14, 'United Kingdom'),
  ('australia', 'Australia', 'Sydney · Melbourne · Brisbane', null, array['Nature','Beach','Culture']::text[], 'beach', 15, 'Australia'),
  ('japan', 'Japan', 'Tokyo · Osaka · Kyoto', null, array['Culture','Nature','Shopping']::text[], 'culture', 16, 'Japan'),
  ('united-states', 'USA', 'New York · Las Vegas · LA', null, array['Culture','Nature','Shopping']::text[], 'city', 17, 'United States'),
  ('canada', 'Canada', 'Toronto · Vancouver · Niagara', null, array['Nature','Culture']::text[], 'nature', 18, 'Canada')
on conflict (slug) do nothing;

-- Idempotent re-run: rows above skipped when slug already exists.

comment on table public.travel_places is 'Curated destinations for trip creation UI; extend by inserting new rows.';
