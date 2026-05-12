-- ============================================================
-- Membership-only access for child tables (is_trip_member).
-- Trips SELECT: member OR row owner (trips.user_id) so INSERT…RETURNING
-- works during create-trip before the organizer members row exists.
-- Backfill organizers for any legacy trips.user_id without a members row.
-- Tighten RPC grants (no PUBLIC execute).
-- ============================================================

insert into public.members (trip_id, user_id, name, email, role)
select t.id, t.user_id, coalesce(nullif(trim(t.title), ''), 'Organizer'), '', 'organizer'
from public.trips t
where t.user_id is not null
  and not exists (
    select 1 from public.members m
    where m.trip_id = t.id and m.user_id = t.user_id
  );

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
  );
$$;

revoke all on function public.is_trip_member(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.is_trip_member(uuid, uuid) to service_role;

drop policy if exists trips_select_member on public.trips;
create policy trips_select_member on public.trips
  for select using (
    public.is_trip_member(id, auth.uid())
    or (
      trips.user_id is not null
      and trips.user_id = auth.uid()
    )
  );

-- Invite RPCs: explicit grants only (revoke default PUBLIC where applicable)
revoke all on function public.get_trip_by_invite_code(text) from public;
grant execute on function public.get_trip_by_invite_code(text) to anon;
grant execute on function public.get_trip_by_invite_code(text) to authenticated;

revoke all on function public.join_trip_by_invite_code(text) from public;
grant execute on function public.join_trip_by_invite_code(text) to authenticated;

revoke all on function public.is_trip_organizer(uuid, uuid) from public;
grant execute on function public.is_trip_organizer(uuid, uuid) to authenticated;
grant execute on function public.is_trip_organizer(uuid, uuid) to service_role;
