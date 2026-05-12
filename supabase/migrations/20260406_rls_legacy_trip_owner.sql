-- ============================================================
-- RLS: legacy trip owner (trips.user_id) without a members row
-- could read/update via is_trip_member but could not DELETE trips
-- or DELETE/UPDATE members. Align policies with app getMemberRole().
-- Apply after 20260403 / 20260404.
-- ============================================================

drop policy if exists trips_delete_organizer on public.trips;
create policy trips_delete_organizer on public.trips
  for delete using (
    exists (
      select 1 from public.members m
      where m.trip_id = trips.id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
    or (
      trips.user_id is not null
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists members_delete_organizer on public.members;
create policy members_delete_organizer on public.members
  for delete using (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
    or exists (
      select 1 from public.trips t
      where t.id = members.trip_id
        and t.user_id is not null
        and t.user_id = auth.uid()
    )
  );

drop policy if exists members_update_organizer on public.members;
create policy members_update_organizer on public.members
  for update using (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
    or exists (
      select 1 from public.trips t
      where t.id = members.trip_id
        and t.user_id is not null
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
    or exists (
      select 1 from public.trips t
      where t.id = members.trip_id
        and t.user_id is not null
        and t.user_id = auth.uid()
    )
  );
