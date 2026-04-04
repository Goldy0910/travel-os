-- ============================================================
-- Storage: trip-docs bucket uploads aligned with app path
--   {auth.uid()}/{trip_id}/{filename}
-- Requires bucket `trip-docs` (or NEXT_PUBLIC_SUPABASE_DOCS_BUCKET).
-- Idempotent policy names.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('trip-docs', 'trip-docs', true)
on conflict (id) do nothing;

drop policy if exists "trip_docs_insert_member_path" on storage.objects;
create policy "trip_docs_insert_member_path"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'trip-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.trip_id = ((storage.foldername(name))[2])::uuid
    )
  );

drop policy if exists "trip_docs_update_member_path" on storage.objects;
create policy "trip_docs_update_member_path"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'trip-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.trip_id = ((storage.foldername(name))[2])::uuid
    )
  )
  with check (
    bucket_id = 'trip-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.trip_id = ((storage.foldername(name))[2])::uuid
    )
  );

drop policy if exists "trip_docs_delete_member_path" on storage.objects;
create policy "trip_docs_delete_member_path"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'trip-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.trip_id = ((storage.foldername(name))[2])::uuid
    )
  );
