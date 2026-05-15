-- Additive metadata for AI hydration → editable itinerary workspace
alter table if exists public.itinerary_items
  add column if not exists google_place_id text,
  add column if not exists notes text,
  add column if not exists category text;

create index if not exists itinerary_items_trip_google_place_idx
  on public.itinerary_items (trip_id)
  where google_place_id is not null;

comment on column public.itinerary_items.google_place_id is
  'Google Places API (New) resource id for activity detail / Maps linkage.';

comment on column public.itinerary_items.notes is
  'AI or user notes; shown on activity detail when set.';

comment on column public.itinerary_items.category is
  'Activity category slug (sightseeing, food, culture, etc.).';
