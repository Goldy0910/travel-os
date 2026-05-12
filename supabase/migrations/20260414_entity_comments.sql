-- ============================================================
-- Comments on itinerary activities and expenses (trip members only)
-- ============================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null,
  entity_type text not null check (entity_type in ('activity', 'expense')),
  entity_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_trip_entity_idx
  on public.comments (trip_id, entity_type, entity_id);

create index if not exists comments_trip_created_idx
  on public.comments (trip_id, created_at desc);

alter table public.comments enable row level security;

drop policy if exists comments_select_member on public.comments;
drop policy if exists comments_insert_member on public.comments;

create policy comments_select_member on public.comments
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy comments_insert_member on public.comments
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and user_id = auth.uid()
    and length(trim(content)) > 0
    and (
      (
        entity_type = 'activity'
        and exists (
          select 1
          from public.itinerary_items i
          where i.trip_id = comments.trip_id
            and i.id::text = trim(comments.entity_id)
        )
      )
      or (
        entity_type = 'expense'
        and exists (
          select 1
          from public.expenses e
          where e.trip_id = comments.trip_id
            and e.id::text = trim(comments.entity_id)
        )
      )
    )
  );
