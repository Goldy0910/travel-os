create table if not exists public.travel_guide_country_presets (
  country text primary key,
  payload jsonb null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.travel_guide_country_presets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'travel_guide_country_presets'
      and policyname = 'travel_guide_country_presets_select_public'
  ) then
    create policy travel_guide_country_presets_select_public
      on public.travel_guide_country_presets
      for select
      using (true);
  end if;
end $$;

insert into public.travel_guide_country_presets (country, payload, is_active)
values
  ('India', null, true),
  ('Japan', null, true),
  ('Thailand', null, true),
  ('Singapore', null, true),
  ('Maldives', null, true),
  ('Malaysia', null, true),
  ('Sri Lanka', null, true),
  ('Indonesia', null, true),
  ('Nepal', null, true),
  ('Vietnam', null, true),
  ('Turkey', null, true),
  ('Switzerland', null, true),
  ('France', null, true),
  ('Italy', null, true),
  ('United Kingdom', null, true),
  ('Australia', null, true),
  ('United States', null, true),
  ('Canada', null, true),
  ('New Zealand', null, true),
  ('Greece', null, true),
  ('Global', null, true)
on conflict (country) do nothing;
