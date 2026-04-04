-- ============================================================
-- Trip group chat (members only, realtime-enabled)
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_trip_created_idx
  on public.messages (trip_id, created_at asc);

alter table public.messages enable row level security;

drop policy if exists messages_select_member on public.messages;
drop policy if exists messages_insert_member on public.messages;

create policy messages_select_member on public.messages
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy messages_insert_member on public.messages
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and user_id = auth.uid()
  );

-- Realtime: new messages broadcast to subscribed clients (RLS still applies per JWT)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
