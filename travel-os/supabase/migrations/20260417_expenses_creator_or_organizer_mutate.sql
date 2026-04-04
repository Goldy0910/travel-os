-- Expenses: only creator (user_id) or trip organizer may update/delete.
-- Legacy rows with user_id null: organizer only.

drop policy if exists expenses_update_member on public.expenses;
create policy expenses_update_creator_or_organizer on public.expenses
  for update
  using (
    public.is_trip_member(trip_id, auth.uid())
    and (
      public.is_trip_organizer(trip_id, auth.uid())
      or (user_id is not null and user_id = auth.uid())
    )
  )
  with check (
    public.is_trip_member(trip_id, auth.uid())
    and (
      public.is_trip_organizer(trip_id, auth.uid())
      or (user_id is not null and user_id = auth.uid())
    )
  );

drop policy if exists expenses_delete_member on public.expenses;
create policy expenses_delete_creator_or_organizer on public.expenses
  for delete using (
    public.is_trip_member(trip_id, auth.uid())
    and (
      public.is_trip_organizer(trip_id, auth.uid())
      or (user_id is not null and user_id = auth.uid())
    )
  );
