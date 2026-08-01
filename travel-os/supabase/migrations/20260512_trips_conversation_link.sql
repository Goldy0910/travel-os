-- ============================================================
-- Link standalone chat conversations → trips (additive)
-- Existing create-trip flow unchanged (leaves these NULL)
-- ============================================================

alter table if exists public.trips
  add column if not exists conversation_id uuid null
    references public.conversations (id) on delete set null;

alter table if exists public.trips
  add column if not exists chat_budget text null;

alter table if exists public.trips
  add column if not exists chat_travelers text null;

create index if not exists trips_conversation_id_idx
  on public.trips (conversation_id)
  where conversation_id is not null;
