-- Allow trip members to delete comments (needed when pruning activities + cleanup)

drop policy if exists comments_delete_member on public.comments;
create policy comments_delete_member on public.comments
  for delete
  to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));
