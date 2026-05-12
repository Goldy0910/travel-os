-- ============================================================
-- Strict role-based RLS
-- Organizer: delete trip, remove/edit members, update trip row
-- Member (and legacy trip owner via is_trip_member): read trip;
--   insert/update/delete itinerary, expenses, documents only as trip member
-- Legacy trips with no members row: cannot delete/update trip until backfilled
--   (see 20260401 backfill). Apply after 20260406.
-- ============================================================

create or replace function public.is_trip_organizer(p_trip uuid, p_user uuid)
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
      and m.role = 'organizer'
  );
$$;

grant execute on function public.is_trip_organizer(uuid, uuid) to authenticated;
grant execute on function public.is_trip_organizer(uuid, uuid) to service_role;

-- ---------- TRIPS ----------
drop policy if exists trips_delete_organizer on public.trips;
drop policy if exists "Only organizer can delete trip" on public.trips;

create policy "Only organizer can delete trip" on public.trips
  for delete using (
    exists (
      select 1
      from public.members
      where members.trip_id = trips.id
        and members.user_id = auth.uid()
        and members.role = 'organizer'
    )
  );

drop policy if exists trips_update_member on public.trips;
drop policy if exists trips_update_organizer on public.trips;

create policy trips_update_organizer on public.trips
  for update
  using (public.is_trip_organizer(id, auth.uid()))
  with check (public.is_trip_organizer(id, auth.uid()));

-- ---------- MEMBERS (organizer-only mutations; no legacy owner bypass) ----------
drop policy if exists members_delete_organizer on public.members;

create policy members_delete_organizer on public.members
  for delete using (
    exists (
      select 1
      from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );

drop policy if exists members_update_organizer on public.members;

create policy members_update_organizer on public.members
  for update using (
    exists (
      select 1
      from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );

-- ---------- ITINERARY_DAYS (members of trip only) ----------
drop policy if exists itinerary_days_all_member on public.itinerary_days;

create policy itinerary_days_select_member on public.itinerary_days
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_days_insert_member on public.itinerary_days
  for insert with check (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_days_update_member on public.itinerary_days
  for update using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_days_delete_member on public.itinerary_days
  for delete using (public.is_trip_member(trip_id, auth.uid()));

-- ---------- ITINERARY_ITEMS ----------
drop policy if exists itinerary_items_all_member on public.itinerary_items;

create policy itinerary_items_select_member on public.itinerary_items
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_items_insert_member on public.itinerary_items
  for insert with check (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_items_update_member on public.itinerary_items
  for update using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy itinerary_items_delete_member on public.itinerary_items
  for delete using (public.is_trip_member(trip_id, auth.uid()));

-- ---------- EXPENSES ----------
drop policy if exists expenses_all_member on public.expenses;

create policy expenses_select_member on public.expenses
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy expenses_insert_member on public.expenses
  for insert with check (public.is_trip_member(trip_id, auth.uid()));

create policy expenses_update_member on public.expenses
  for update using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy expenses_delete_member on public.expenses
  for delete using (public.is_trip_member(trip_id, auth.uid()));

-- ---------- DOCUMENTS ----------
drop policy if exists documents_all_member on public.documents;

create policy documents_select_member on public.documents
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy documents_insert_member on public.documents
  for insert with check (public.is_trip_member(trip_id, auth.uid()));

create policy documents_update_member on public.documents
  for update using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

create policy documents_delete_member on public.documents
  for delete using (public.is_trip_member(trip_id, auth.uid()));
