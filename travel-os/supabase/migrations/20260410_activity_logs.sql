-- ============================================================
-- Trip activity feed (append-only log for members)
-- ============================================================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_trip_created_idx
  on public.activity_logs (trip_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_select_member on public.activity_logs;
drop policy if exists activity_logs_insert_member on public.activity_logs;

create policy activity_logs_select_member on public.activity_logs
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy activity_logs_insert_member on public.activity_logs
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and user_id = auth.uid()
  );
