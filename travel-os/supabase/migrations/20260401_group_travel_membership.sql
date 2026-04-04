-- ============================================================
-- Travel OS: group travel + membership-based access
-- Run in Supabase SQL Editor (or supabase db push)
-- ============================================================

-- ---------- members table ----------
-- Ensure table exists with expected columns (adjust if your table differs)

alter table public.members
  add column if not exists created_at timestamptz default now();

-- Allow invited rows before the user signs up
alter table public.members
  alter column user_id drop not null;

-- Email required for invites / matching
alter table public.members
  alter column email set default '';

update public.members set email = '' where email is null;

-- Role check
alter table public.members drop constraint if exists members_role_check;
alter table public.members
  add constraint members_role_check check (role in ('organizer', 'member'));

-- Uniques: one membership per user per trip (when user_id set)
create unique index if not exists members_trip_user_unique
  on public.members (trip_id, user_id)
  where user_id is not null;

-- One pending invite per email per trip
create unique index if not exists members_trip_email_pending_unique
  on public.members (trip_id, lower(trim(email)))
  where user_id is null and coalesce(trim(email), '') <> '';

-- ---------- Backfill: creator as organizer ----------
insert into public.members (trip_id, user_id, name, email, role)
select t.id, t.user_id, coalesce(nullif(trim(t.title), ''), 'Organizer'), '', 'organizer'
from public.trips t
where t.user_id is not null
  and not exists (
    select 1 from public.members m
    where m.trip_id = t.id and m.user_id = t.user_id
  );

-- ---------- Link invites when user signs up (same email) ----------
create or replace function public.link_members_to_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.members
  set user_id = new.id,
      name = case
        when trim(coalesce(members.name, '')) = '' or members.name = members.email
        then coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1))
        else members.name
      end
  where user_id is null
    and lower(trim(members.email)) = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_link_members_on_auth_user on auth.users;
create trigger trg_link_members_on_auth_user
  after insert on auth.users
  for each row execute procedure public.link_members_to_new_user();

-- ---------- RLS: enable ----------
alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.expenses enable row level security;
alter table public.documents enable row level security;

-- ---------- Helper: is member of trip ----------
create or replace function public.is_trip_member(p_trip uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.trip_id = p_trip and m.user_id = p_user
  );
$$;

-- ---------- TRIPS ----------
drop policy if exists trips_select_member on public.trips;
create policy trips_select_member on public.trips
  for select using (public.is_trip_member(id, auth.uid()));

drop policy if exists trips_insert_creator on public.trips;
create policy trips_insert_creator on public.trips
  for insert with check (user_id = auth.uid());

drop policy if exists trips_update_member on public.trips;
create policy trips_update_member on public.trips
  for update using (public.is_trip_member(id, auth.uid()))
  with check (public.is_trip_member(id, auth.uid()));

drop policy if exists trips_delete_organizer on public.trips;
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
drop policy if exists members_select_same_trip on public.members;
create policy members_select_same_trip on public.members
  for select using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists members_insert_organizer on public.members;
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

-- ---------- ITINERARY ----------
drop policy if exists itinerary_days_all_member on public.itinerary_days;
create policy itinerary_days_all_member on public.itinerary_days
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists itinerary_items_all_member on public.itinerary_items;
create policy itinerary_items_all_member on public.itinerary_items
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

-- ---------- EXPENSES ----------
drop policy if exists expenses_all_member on public.expenses;
create policy expenses_all_member on public.expenses
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

-- ---------- DOCUMENTS ----------
drop policy if exists documents_all_member on public.documents;
create policy documents_all_member on public.documents
  for all using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

-- ---------- Storage (optional): align with trip membership ----------
-- Create policies in Dashboard → Storage for bucket trip-docs, e.g.:
-- (storage.foldername(name))[1] = auth.uid()::text
-- OR use a storage policy that checks members via trip_id in path — app uses userId/tripId/...
