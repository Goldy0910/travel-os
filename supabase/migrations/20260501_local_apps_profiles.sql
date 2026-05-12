create table if not exists public.local_apps_profiles (
  profile_key text primary key,
  city text not null,
  country text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.local_apps_aliases (
  alias text primary key,
  profile_key text not null references public.local_apps_profiles(profile_key) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_local_apps_aliases_profile_key
  on public.local_apps_aliases (profile_key);

insert into public.local_apps_profiles (profile_key, city, country)
values
  ('uae', 'Dubai', 'United Arab Emirates'),
  ('thailand', 'Thailand', 'Thailand'),
  ('singapore', 'Singapore', 'Singapore'),
  ('maldives', 'Maldives', 'Maldives'),
  ('malaysia', 'Malaysia', 'Malaysia'),
  ('sri-lanka', 'Sri Lanka', 'Sri Lanka'),
  ('indonesia', 'Indonesia', 'Indonesia'),
  ('nepal', 'Nepal', 'Nepal'),
  ('vietnam', 'Vietnam', 'Vietnam'),
  ('turkey', 'Turkey', 'Turkey'),
  ('switzerland', 'Switzerland', 'Switzerland'),
  ('france', 'France', 'France'),
  ('italy', 'Italy', 'Italy'),
  ('uk', 'United Kingdom', 'United Kingdom'),
  ('australia', 'Australia', 'Australia'),
  ('japan', 'Japan', 'Japan'),
  ('usa', 'United States', 'United States'),
  ('canada', 'Canada', 'Canada'),
  ('new-zealand', 'New Zealand', 'New Zealand'),
  ('greece', 'Greece', 'Greece'),
  ('india', 'India', 'India'),
  ('global', 'Global', 'International')
on conflict (profile_key) do update
set city = excluded.city,
    country = excluded.country,
    updated_at = now();

insert into public.local_apps_aliases (alias, profile_key)
values
  ('dubai', 'uae'),
  ('abu dhabi', 'uae'),
  ('sharjah', 'uae'),
  ('uae', 'uae'),
  ('emirates', 'uae'),
  ('united arab emirates', 'uae'),

  ('thailand', 'thailand'),
  ('bangkok', 'thailand'),
  ('phuket', 'thailand'),
  ('krabi', 'thailand'),
  ('chiang mai', 'thailand'),
  ('pattaya', 'thailand'),
  ('koh samui', 'thailand'),

  ('singapore', 'singapore'),
  ('maldives', 'maldives'),
  ('male', 'maldives'),
  ('maafushi', 'maldives'),
  ('hulhumale', 'maldives'),

  ('malaysia', 'malaysia'),
  ('kuala lumpur', 'malaysia'),
  ('kl', 'malaysia'),
  ('penang', 'malaysia'),
  ('johor bahru', 'malaysia'),
  ('jb', 'malaysia'),
  ('langkawi', 'malaysia'),

  ('sri lanka', 'sri-lanka'),
  ('colombo', 'sri-lanka'),
  ('kandy', 'sri-lanka'),
  ('galle', 'sri-lanka'),
  ('ella', 'sri-lanka'),

  ('indonesia', 'indonesia'),
  ('bali', 'indonesia'),
  ('jakarta', 'indonesia'),
  ('bandung', 'indonesia'),
  ('surabaya', 'indonesia'),
  ('yogyakarta', 'indonesia'),
  ('lombok', 'indonesia'),

  ('nepal', 'nepal'),
  ('kathmandu', 'nepal'),
  ('pokhara', 'nepal'),

  ('vietnam', 'vietnam'),
  ('hanoi', 'vietnam'),
  ('ho chi minh', 'vietnam'),
  ('saigon', 'vietnam'),
  ('da nang', 'vietnam'),
  ('hoi an', 'vietnam'),

  ('turkey', 'turkey'),
  ('istanbul', 'turkey'),
  ('ankara', 'turkey'),
  ('izmir', 'turkey'),
  ('cappadocia', 'turkey'),

  ('switzerland', 'switzerland'),
  ('zurich', 'switzerland'),
  ('geneva', 'switzerland'),
  ('lucerne', 'switzerland'),
  ('interlaken', 'switzerland'),

  ('france', 'france'),
  ('paris', 'france'),
  ('lyon', 'france'),
  ('nice', 'france'),
  ('marseille', 'france'),

  ('italy', 'italy'),
  ('rome', 'italy'),
  ('milan', 'italy'),
  ('venice', 'italy'),
  ('florence', 'italy'),

  ('united kingdom', 'uk'),
  ('uk', 'uk'),
  ('britain', 'uk'),
  ('london', 'uk'),
  ('manchester', 'uk'),
  ('edinburgh', 'uk'),

  ('australia', 'australia'),
  ('sydney', 'australia'),
  ('melbourne', 'australia'),
  ('brisbane', 'australia'),
  ('perth', 'australia'),

  ('japan', 'japan'),
  ('tokyo', 'japan'),
  ('osaka', 'japan'),
  ('kyoto', 'japan'),

  ('united states', 'usa'),
  ('usa', 'usa'),
  ('us', 'usa'),
  ('new york', 'usa'),
  ('los angeles', 'usa'),
  ('las vegas', 'usa'),

  ('canada', 'canada'),
  ('toronto', 'canada'),
  ('vancouver', 'canada'),
  ('montreal', 'canada'),

  ('new zealand', 'new-zealand'),
  ('nz', 'new-zealand'),
  ('auckland', 'new-zealand'),
  ('wellington', 'new-zealand'),

  ('greece', 'greece'),
  ('athens', 'greece'),
  ('thessaloniki', 'greece'),
  ('santorini', 'greece'),
  ('mykonos', 'greece'),

  ('india', 'india'),
  ('manali', 'india'),
  ('mussoorie', 'india'),
  ('goa', 'india'),
  ('new delhi', 'india'),
  ('mumbai', 'india')
on conflict (alias) do update
set profile_key = excluded.profile_key;
