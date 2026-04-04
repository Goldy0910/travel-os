-- ============================================================
-- Invite link join: RPCs bypass trips/members RLS safely
-- (anon cannot select trips; members insert is organizer-only)
-- ============================================================

create or replace function public.get_trip_by_invite_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_code, ''));
  r record;
begin
  if length(v_trim) < 8 then
    return jsonb_build_object('found', false);
  end if;

  select
    t.id,
    coalesce(
      nullif(trim(t.title), ''),
      nullif(trim(t.location), ''),
      'Trip'
    ) as title,
    coalesce(t.location, '') as location
  into r
  from public.trips t
  where t.invite_code is not null
    and t.invite_code = v_trim
  limit 1;

  if r.id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'trip_id', r.id,
    'title', r.title,
    'location', r.location
  );
end;
$$;

create or replace function public.join_trip_by_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_code, ''));
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_email text;
  v_name text;
  v_updated int;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if length(v_trim) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select t.id
  into v_trip_id
  from public.trips t
  where t.invite_code is not null
    and t.invite_code = v_trim
  limit 1;

  if v_trip_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select
    u.email,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      split_part(u.email, '@', 1)
    )
  into v_email, v_name
  from auth.users u
  where u.id = v_user_id;

  if exists (
    select 1
    from public.members m
    where m.trip_id = v_trip_id
      and m.user_id = v_user_id
  ) then
    return jsonb_build_object(
      'ok', true,
      'trip_id', v_trip_id,
      'already_member', true
    );
  end if;

  update public.members m
  set
    user_id = v_user_id,
    name = case
      when trim(coalesce(m.name, '')) = ''
        or lower(trim(m.name)) = lower(trim(coalesce(m.email, '')))
      then coalesce(v_name, split_part(v_email, '@', 1))
      else m.name
    end
  where m.trip_id = v_trip_id
    and m.user_id is null
    and v_email is not null
    and lower(trim(m.email)) = lower(trim(v_email));

  get diagnostics v_updated = ROW_COUNT;
  if v_updated > 0 then
    return jsonb_build_object(
      'ok', true,
      'trip_id', v_trip_id,
      'already_member', false,
      'claimed_invite', true
    );
  end if;

  insert into public.members (trip_id, user_id, email, name, role)
  values (
    v_trip_id,
    v_user_id,
    coalesce(v_email, ''),
    coalesce(v_name, 'Member'),
    'member'
  );

  return jsonb_build_object(
    'ok', true,
    'trip_id', v_trip_id,
    'already_member', false,
    'claimed_invite', false
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', true,
      'trip_id', v_trip_id,
      'already_member', true
    );
end;
$$;

grant execute on function public.get_trip_by_invite_code(text) to anon;
grant execute on function public.get_trip_by_invite_code(text) to authenticated;
grant execute on function public.join_trip_by_invite_code(text) to authenticated;
