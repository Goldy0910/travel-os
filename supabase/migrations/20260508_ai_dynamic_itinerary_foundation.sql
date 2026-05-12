-- ============================================================
-- AI dynamic itinerary foundation (additive + backward compatible)
-- ============================================================

-- ---------- itinerary_items metadata (non-breaking additive columns) ----------
alter table if exists public.itinerary_items
  add column if not exists priority_score integer,
  add column if not exists sunset_sensitive boolean not null default false,
  add column if not exists booking_required boolean not null default false,
  add column if not exists ai_generated boolean not null default false,
  add column if not exists user_modified boolean not null default false;

alter table if exists public.itinerary_items
  drop constraint if exists itinerary_items_priority_score_range;

alter table if exists public.itinerary_items
  add constraint itinerary_items_priority_score_range
  check (priority_score is null or (priority_score >= 0 and priority_score <= 100));

create index if not exists itinerary_items_trip_priority_idx
  on public.itinerary_items (trip_id, priority_score desc nulls last);

create index if not exists itinerary_items_trip_ai_flags_idx
  on public.itinerary_items (trip_id, ai_generated, user_modified);

-- ---------- status enum for activity state ----------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'itinerary_activity_status'
      and n.nspname = 'public'
  ) then
    create type public.itinerary_activity_status as enum (
      'pending',
      'completed',
      'skipped',
      'delayed',
      'replaced'
    );
  end if;
end
$$;

-- ---------- itinerary_activity_state ----------
do $$
declare
  activity_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into activity_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'itinerary_items'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if activity_id_type is null then
    raise exception 'Could not resolve type for public.itinerary_items.id';
  end if;

  execute format(
    'create table if not exists public.itinerary_activity_state (
      id uuid primary key default gen_random_uuid(),
      activity_id %s null references public.itinerary_items (id) on delete set null,
      status public.itinerary_activity_status not null default ''pending'',
      completed_at timestamptz null,
      skipped_reason text null,
      delay_minutes integer null,
      user_feedback text null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )',
    activity_id_type
  );
end
$$;

alter table if exists public.itinerary_activity_state
  drop constraint if exists itinerary_activity_state_delay_minutes_check;

alter table if exists public.itinerary_activity_state
  add constraint itinerary_activity_state_delay_minutes_check
  check (delay_minutes is null or delay_minutes >= 0);

create index if not exists itinerary_activity_state_activity_idx
  on public.itinerary_activity_state (activity_id, created_at desc);

create index if not exists itinerary_activity_state_status_idx
  on public.itinerary_activity_state (status, created_at desc);

-- ---------- itinerary_revisions ----------
do $$
declare
  trip_id_type text;
  day_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into trip_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'trips'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod)
    into day_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'itinerary_days'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if trip_id_type is null then
    raise exception 'Could not resolve type for public.trips.id';
  end if;
  if day_id_type is null then
    raise exception 'Could not resolve type for public.itinerary_days.id';
  end if;

  execute format(
    'create table if not exists public.itinerary_revisions (
      id uuid primary key default gen_random_uuid(),
      trip_id %s not null references public.trips (id) on delete cascade,
      day_id %s null references public.itinerary_days (id) on delete set null,
      revision_reason text not null,
      previous_snapshot jsonb not null default ''{}''::jsonb,
      updated_snapshot jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now()
    )',
    trip_id_type,
    day_id_type
  );
end
$$;

create index if not exists itinerary_revisions_trip_created_idx
  on public.itinerary_revisions (trip_id, created_at desc);

create index if not exists itinerary_revisions_day_created_idx
  on public.itinerary_revisions (day_id, created_at desc);

-- ---------- ai_conversations ----------
do $$
declare
  trip_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into trip_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'trips'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if trip_id_type is null then
    raise exception 'Could not resolve type for public.trips.id';
  end if;

  execute format(
    'create table if not exists public.ai_conversations (
      id uuid primary key default gen_random_uuid(),
      trip_id %s not null references public.trips (id) on delete cascade,
      user_id uuid not null,
      intent text not null,
      message text not null,
      response jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now()
    )',
    trip_id_type
  );
end
$$;

create index if not exists ai_conversations_trip_created_idx
  on public.ai_conversations (trip_id, created_at desc);

create index if not exists ai_conversations_trip_user_created_idx
  on public.ai_conversations (trip_id, user_id, created_at desc);

create index if not exists ai_conversations_intent_idx
  on public.ai_conversations (intent, created_at desc);

-- ---------- keep updated_at synced for itinerary_activity_state ----------
create or replace function public.set_itinerary_activity_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_itinerary_activity_state_updated_at on public.itinerary_activity_state;

create trigger trg_itinerary_activity_state_updated_at
before update on public.itinerary_activity_state
for each row
execute function public.set_itinerary_activity_state_updated_at();

-- ---------- RLS ----------
alter table public.itinerary_activity_state enable row level security;
alter table public.itinerary_revisions enable row level security;
alter table public.ai_conversations enable row level security;

drop policy if exists itinerary_activity_state_select_member on public.itinerary_activity_state;
drop policy if exists itinerary_activity_state_insert_member on public.itinerary_activity_state;
drop policy if exists itinerary_activity_state_update_member on public.itinerary_activity_state;
drop policy if exists itinerary_activity_state_delete_member on public.itinerary_activity_state;

create policy itinerary_activity_state_select_member on public.itinerary_activity_state
  for select using (
    exists (
      select 1
      from public.itinerary_items i
      where i.id = itinerary_activity_state.activity_id
        and public.is_trip_member(i.trip_id, auth.uid())
    )
  );

create policy itinerary_activity_state_insert_member on public.itinerary_activity_state
  for insert with check (
    exists (
      select 1
      from public.itinerary_items i
      where i.id = itinerary_activity_state.activity_id
        and public.is_trip_member(i.trip_id, auth.uid())
    )
  );

create policy itinerary_activity_state_update_member on public.itinerary_activity_state
  for update using (
    exists (
      select 1
      from public.itinerary_items i
      where i.id = itinerary_activity_state.activity_id
        and public.is_trip_member(i.trip_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.itinerary_items i
      where i.id = itinerary_activity_state.activity_id
        and public.is_trip_member(i.trip_id, auth.uid())
    )
  );

create policy itinerary_activity_state_delete_member on public.itinerary_activity_state
  for delete using (
    exists (
      select 1
      from public.itinerary_items i
      where i.id = itinerary_activity_state.activity_id
        and public.is_trip_member(i.trip_id, auth.uid())
    )
  );

drop policy if exists itinerary_revisions_select_member on public.itinerary_revisions;
drop policy if exists itinerary_revisions_insert_member on public.itinerary_revisions;

create policy itinerary_revisions_select_member on public.itinerary_revisions
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_revisions_insert_member on public.itinerary_revisions
  for insert with check (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists ai_conversations_select_member on public.ai_conversations;
drop policy if exists ai_conversations_insert_member on public.ai_conversations;

create policy ai_conversations_select_member on public.ai_conversations
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy ai_conversations_insert_member on public.ai_conversations
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and user_id = auth.uid()
  );
