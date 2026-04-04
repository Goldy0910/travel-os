-- ============================================================
-- Remove legacy / duplicate RLS policies on trip-related tables,
-- then re-apply the canonical membership-only rules.
-- Run after 20260401 (and optionally 20260402). Safe to re-run.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'trips',
        'members',
        'itinerary_days',
        'itinerary_items',
        'expenses',
        'documents'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Membership helper: member row OR trip creator (covers legacy data with no members row).
create or replace function public.is_trip_member(p_trip uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.trip_id = p_trip
      and m.user_id is not null
      and m.user_id = p_user
  )
  or exists (
    select 1 from public.trips t
    where t.id = p_trip
      and t.user_id is not null
      and t.user_id = p_user
  );
$$;

grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.is_trip_member(uuid, uuid) to service_role;

-- ---------- TRIPS (read/update only as member; insert as self creator; delete as organizer) ----------
create policy trips_select_member on public.trips
  for select using (public.is_trip_member(id, auth.uid()));

create policy trips_insert_creator on public.trips
  for insert with check (
    auth.uid() is not null
    and user_id = auth.uid()
  );

create policy trips_update_member on public.trips
  for update using (public.is_trip_member(id, auth.uid()))
  with check (public.is_trip_member(id, auth.uid()));

create policy trips_delete_organizer on public.trips
  for delete using (
    exists (
      select 1 from public.members m
      where m.trip_id = trips.id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );

-- ---------- MEMBERS ----------
create policy members_select_same_trip on public.members
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy members_insert_organizer on public.members
  for insert with check (
    (
      exists (
        select 1 from public.trips t
        where t.id = members.trip_id and t.user_id = auth.uid()
      )
      and members.user_id = auth.uid()
      and members.role = 'organizer'
    )
    or exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );

create policy members_update_organizer on public.members
  for update using (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );

create policy members_delete_organizer on public.members
  for delete using (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );

-- ---------- Child tables: trip_id membership only ----------
create policy itinerary_days_all_member on public.itinerary_days
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_items_all_member on public.itinerary_items
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy expenses_all_member on public.expenses
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy documents_all_member on public.documents
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));
