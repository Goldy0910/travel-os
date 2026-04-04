-- Restore access for trips that only have trips.user_id set (no members row yet).
-- Run in SQL Editor if your app lists zero trips after enabling group-travel RLS.

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

drop policy if exists trips_select_member on public.trips;
create policy trips_select_member on public.trips
  for select using (public.is_trip_member(id, auth.uid()));
