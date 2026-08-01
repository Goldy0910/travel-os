-- ============================================================
-- Discovery agent fields on conversation_memory (chat-only)
-- ============================================================

alter table if exists public.conversation_memory
  add column if not exists weather_preference text null,
  add column if not exists visa_preference text null,
  add column if not exists travel_duration text null,
  add column if not exists discovery_active boolean not null default false,
  add column if not exists discovery_phase text not null default 'idle',
  add column if not exists candidate_destinations jsonb not null default '[]'::jsonb;

alter table if exists public.conversation_memory
  drop constraint if exists conversation_memory_discovery_phase_check;

alter table if exists public.conversation_memory
  add constraint conversation_memory_discovery_phase_check
  check (discovery_phase in ('idle', 'gathering', 'narrowing', 'shortlist', 'complete'));

alter table if exists public.conversation_memory
  drop constraint if exists conversation_memory_candidate_destinations_is_array;

alter table if exists public.conversation_memory
  add constraint conversation_memory_candidate_destinations_is_array
  check (jsonb_typeof(candidate_destinations) = 'array');
