-- Add New Zealand and Greece to curated create-trip destinations.

insert into public.travel_places (slug, primary_label, subtitle, visa_note, tags, icon_key, sort_order, canonical_location)
values
  (
    'new-zealand',
    'New Zealand',
    'Auckland · Queenstown',
    null,
    array['Nature','Beach']::text[],
    'nature',
    19,
    'New Zealand'
  ),
  (
    'greece',
    'Greece',
    'Athens · Santorini · Mykonos',
    null,
    array['Beach','Culture','Nature']::text[],
    'beach',
    20,
    'Greece'
  )
on conflict (slug) do nothing;
