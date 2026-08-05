-- Traveler Interest Indicator: monthly unique-traveler analytics for top-level destinations.
-- Failures here must never block product flows — callers treat RPC errors as non-fatal.

create table if not exists public.destination_interest_monthly (
  id uuid primary key default gen_random_uuid(),
  destination_id text not null,
  year int not null,
  month int not null,
  unique_travelers int not null default 0,
  search_count int not null default 0,
  ai_recommendation_count int not null default 0,
  detail_view_count int not null default 0,
  trip_add_count int not null default 0,
  favorite_count int not null default 0,
  total_interest int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_interest_monthly_year_chk check (year >= 2000 and year <= 2100),
  constraint destination_interest_monthly_month_chk check (month >= 1 and month <= 12),
  constraint destination_interest_monthly_counts_chk check (
    unique_travelers >= 0
    and search_count >= 0
    and ai_recommendation_count >= 0
    and detail_view_count >= 0
    and trip_add_count >= 0
    and favorite_count >= 0
    and total_interest >= 0
  ),
  constraint destination_interest_monthly_dest_period_key unique (destination_id, year, month)
);

create index if not exists destination_interest_monthly_dest_idx
  on public.destination_interest_monthly (destination_id);

create index if not exists destination_interest_monthly_period_idx
  on public.destination_interest_monthly (year desc, month desc);

comment on table public.destination_interest_monthly is
  'Monthly aggregated traveler interest for top-level destinations (cities/regions/countries).';

create table if not exists public.destination_interest_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  destination_id text not null,
  event_type text not null,
  year int not null,
  month int not null,
  created_at timestamptz not null default now(),
  constraint destination_interest_events_year_chk check (year >= 2000 and year <= 2100),
  constraint destination_interest_events_month_chk check (month >= 1 and month <= 12),
  constraint destination_interest_events_type_chk check (
    event_type in ('SEARCH', 'AI_RECOMMENDED', 'DETAIL_VIEW', 'TRIP_ADD', 'FAVORITE')
  )
);

create index if not exists destination_interest_events_user_dest_month_idx
  on public.destination_interest_events (user_id, destination_id, year, month);

create index if not exists destination_interest_events_dest_period_idx
  on public.destination_interest_events (destination_id, year, month, event_type);

create index if not exists destination_interest_events_created_at_idx
  on public.destination_interest_events (created_at desc);

comment on table public.destination_interest_events is
  'Per-actor interest events. unique_travelers increments only on the first event per user/destination/month.';

create or replace function public.set_destination_interest_monthly_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_destination_interest_monthly_updated_at
  on public.destination_interest_monthly;

create trigger trg_destination_interest_monthly_updated_at
before update on public.destination_interest_monthly
for each row
execute function public.set_destination_interest_monthly_updated_at();

alter table public.destination_interest_monthly enable row level security;
alter table public.destination_interest_events enable row level security;

drop policy if exists destination_interest_monthly_select_all on public.destination_interest_monthly;
create policy destination_interest_monthly_select_all
  on public.destination_interest_monthly
  for select
  to anon, authenticated
  using (true);

-- Events are write-only via SECURITY DEFINER RPC (no direct client mutations).
revoke insert, update, delete on public.destination_interest_monthly from anon, authenticated, public;
revoke insert, update, delete on public.destination_interest_events from anon, authenticated, public;
revoke select on public.destination_interest_events from anon, authenticated, public;
grant select on public.destination_interest_monthly to anon, authenticated;

create or replace function public.track_destination_interest(
  p_destination_id text,
  p_event_type text,
  p_actor_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
  v_dest text;
  v_type text;
  v_year int;
  v_month int;
  v_is_new int := 0;
  v_search int := 0;
  v_ai int := 0;
  v_view int := 0;
  v_trip int := 0;
  v_fav int := 0;
begin
  v_dest := lower(trim(coalesce(p_destination_id, '')));
  v_type := upper(trim(coalesce(p_event_type, '')));
  v_actor := nullif(trim(coalesce(auth.uid()::text, '')), '');
  if v_actor is null then
    v_actor := nullif(trim(coalesce(p_actor_id, '')), '');
  end if;

  if v_dest is null or v_dest = '' or length(v_dest) > 96 then
    raise exception 'invalid_destination_id' using errcode = '22023';
  end if;
  if v_actor is null or length(v_actor) > 128 then
    raise exception 'invalid_actor' using errcode = '22023';
  end if;
  if v_type not in ('SEARCH', 'AI_RECOMMENDED', 'DETAIL_VIEW', 'TRIP_ADD', 'FAVORITE') then
    raise exception 'invalid_event_type' using errcode = '22023';
  end if;

  v_year := extract(year from (timezone('utc', now())))::int;
  v_month := extract(month from (timezone('utc', now())))::int;

  -- Serialize per actor+destination+month so unique_travelers stays accurate under concurrency.
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor || chr(31) || v_dest || chr(31) || v_year::text || chr(31) || v_month::text, 0)
  );

  if not exists (
    select 1
    from public.destination_interest_events e
    where e.user_id = v_actor
      and e.destination_id = v_dest
      and e.year = v_year
      and e.month = v_month
  ) then
    v_is_new := 1;
  end if;

  insert into public.destination_interest_events (
    user_id, destination_id, event_type, year, month
  ) values (
    v_actor, v_dest, v_type, v_year, v_month
  );

  if v_type = 'SEARCH' then v_search := 1; end if;
  if v_type = 'AI_RECOMMENDED' then v_ai := 1; end if;
  if v_type = 'DETAIL_VIEW' then v_view := 1; end if;
  if v_type = 'TRIP_ADD' then v_trip := 1; end if;
  if v_type = 'FAVORITE' then v_fav := 1; end if;

  insert into public.destination_interest_monthly (
    destination_id,
    year,
    month,
    unique_travelers,
    search_count,
    ai_recommendation_count,
    detail_view_count,
    trip_add_count,
    favorite_count,
    total_interest
  ) values (
    v_dest,
    v_year,
    v_month,
    v_is_new,
    v_search,
    v_ai,
    v_view,
    v_trip,
    v_fav,
    1
  )
  on conflict (destination_id, year, month) do update set
    unique_travelers = public.destination_interest_monthly.unique_travelers + excluded.unique_travelers,
    search_count = public.destination_interest_monthly.search_count + excluded.search_count,
    ai_recommendation_count = public.destination_interest_monthly.ai_recommendation_count + excluded.ai_recommendation_count,
    detail_view_count = public.destination_interest_monthly.detail_view_count + excluded.detail_view_count,
    trip_add_count = public.destination_interest_monthly.trip_add_count + excluded.trip_add_count,
    favorite_count = public.destination_interest_monthly.favorite_count + excluded.favorite_count,
    total_interest = public.destination_interest_monthly.total_interest + excluded.total_interest,
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'destinationId', v_dest,
    'year', v_year,
    'month', v_month,
    'newUniqueTraveler', v_is_new = 1
  );
end;
$$;

comment on function public.track_destination_interest(text, text, text) is
  'Atomically record a destination interest event and upsert the current month aggregate.';

revoke all on function public.track_destination_interest(text, text, text) from public;
grant execute on function public.track_destination_interest(text, text, text) to anon, authenticated, service_role;
