-- Cache representative destination photos from Google Places (New API).
-- Stored per curated travel place to avoid repeated external API calls.

alter table public.travel_places
  add column if not exists place_photo_name text,
  add column if not exists place_photo_ref text,
  add column if not exists place_photo_cached_at timestamptz;

comment on column public.travel_places.place_photo_name is
  'Google Places (New) photo resource name: places/{place_id}/photos/{photo_id}.';
comment on column public.travel_places.place_photo_ref is
  'Legacy photo reference fallback (if available).';
comment on column public.travel_places.place_photo_cached_at is
  'When photo metadata was last refreshed from Google Places.';
