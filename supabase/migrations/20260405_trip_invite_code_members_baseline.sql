-- ============================================================
-- Per-trip invite_code (unique, auto-generated on insert)
-- Apply after 20260404. Idempotent.
-- Members table: see 20260331_members_table_if_missing.sql
-- ============================================================

-- ---------- trips: unique invite token per trip ----------
alter table public.trips
  add column if not exists invite_code text;

create unique index if not exists trips_invite_code_unique
  on public.trips (invite_code)
  where invite_code is not null;

-- Auto-fill invite_code on insert when omitted (32-char hex, no hyphens)
create or replace function public.set_trip_invite_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.invite_code is null or btrim(new.invite_code) = '' then
    new.invite_code := replace(gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_trip_invite_code on public.trips;
create trigger trg_set_trip_invite_code
  before insert on public.trips
  for each row
  execute procedure public.set_trip_invite_code();

-- Existing rows
update public.trips
set invite_code = replace(gen_random_uuid()::text, '-', '')
where invite_code is null or btrim(invite_code) = '';

-- ---------- RLS intent (canonical policies live in 20260401 / 20260403) ----------
-- Trips: SELECT only if the user is a member (members row) or legacy owner — see
--   policy trips_select_member using (is_trip_member(id, auth.uid())).
-- Members: SELECT only for users who are members of that trip — see
--   policy members_select_same_trip using (is_trip_member(trip_id, auth.uid())).
-- Do NOT use "user_id = auth.uid() OR true" on members; it exposes all rows to every user.
