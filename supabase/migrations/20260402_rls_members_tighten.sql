-- ============================================================
-- Tighten members RLS (WITH CHECK on UPDATE) + organizer DELETE
-- Apply after 20260401_group_travel_membership.sql
-- ============================================================

drop policy if exists members_update_organizer on public.members;
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

drop policy if exists members_delete_organizer on public.members;
create policy members_delete_organizer on public.members
  for delete using (
    exists (
      select 1 from public.members m
      where m.trip_id = members.trip_id
        and m.user_id = auth.uid()
        and m.role = 'organizer'
    )
  );
