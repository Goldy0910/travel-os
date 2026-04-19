-- Tracks whether the organizer/member chose how to create the itinerary (AI / PDF / manual).
-- Existing trips default to complete so we do not interrupt current users.

alter table public.trips
  add column if not exists itinerary_setup_complete boolean not null default true;

comment on column public.trips.itinerary_setup_complete is
  'When false, itinerary tab shows the creation-choice prompt until AI import, PDF import, or manual path succeeds.';
