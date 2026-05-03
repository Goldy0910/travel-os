-- Hyderabad (Telangana) for create-trip picker + Local Apps resolution

insert into public.travel_places (slug, primary_label, subtitle, visa_note, tags, icon_key, sort_order, canonical_location)
values (
  'hyderabad-india',
  'Hyderabad',
  'Telangana',
  null,
  array['City','Culture','Food']::text[],
  'city',
  41,
  'Hyderabad, India'
)
on conflict (slug) do nothing;

insert into public.local_apps_profiles (profile_key, city, country)
values ('hyderabad', 'Hyderabad', 'India')
on conflict (profile_key) do update
set city = excluded.city,
    country = excluded.country,
    updated_at = now();

insert into public.local_apps_aliases (alias, profile_key)
values
  ('hyderabad', 'hyderabad'),
  ('hyderabad, india', 'hyderabad'),
  ('telangana', 'hyderabad'),
  ('secunderabad', 'hyderabad'),
  ('hitech city', 'hyderabad'),
  ('cyberabad', 'hyderabad')
on conflict (alias) do update
set profile_key = excluded.profile_key;
