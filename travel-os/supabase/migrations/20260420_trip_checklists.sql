-- Trip packing checklists (personal per member + one shared group list)

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  constraint checklists_shared_user_ck check (
    (is_shared = true and user_id is null)
    or (is_shared = false and user_id is not null)
  )
);

create unique index if not exists checklists_one_personal_per_user
  on public.checklists (trip_id, user_id)
  where is_shared = false;

create unique index if not exists checklists_one_shared_per_trip
  on public.checklists (trip_id)
  where is_shared = true;

create index if not exists checklists_trip_idx on public.checklists (trip_id);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  label text not null,
  category text not null default 'misc',
  is_checked boolean not null default false,
  sort_order int not null default 0,
  created_by uuid null,
  checked_by uuid null,
  checked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists checklist_items_checklist_idx
  on public.checklist_items (checklist_id, sort_order);

-- Optional templates (read-only for app users)
-- trip_type: required in some deployments (e.g. weekend / beach / business); keep NOT NULL with a default.
create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trip_type text not null default 'general',
  created_at timestamptz not null default now()
);

-- If the table was created earlier without trip_type, add it (existing rows get 'general').
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checklist_templates'
      and column_name = 'trip_type'
  ) then
    alter table public.checklist_templates
      add column trip_type text not null default 'general';
  end if;
end $$;

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates (id) on delete cascade,
  label text not null,
  category text not null default 'misc',
  sort_order int not null default 0
);

create index if not exists checklist_template_items_tpl_idx
  on public.checklist_template_items (template_id, sort_order);

alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;

-- checklists
drop policy if exists checklists_select_member on public.checklists;
create policy checklists_select_member on public.checklists
  for select using (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists checklists_insert_member on public.checklists;
create policy checklists_insert_member on public.checklists
  for insert with check (
    public.is_trip_member(trip_id, auth.uid())
    and (
      (is_shared = true and user_id is null)
      or (is_shared = false and user_id = auth.uid())
    )
  );

drop policy if exists checklists_update_member on public.checklists;
create policy checklists_update_member on public.checklists
  for update using (public.is_trip_member(trip_id, auth.uid()))
  with check (public.is_trip_member(trip_id, auth.uid()));

drop policy if exists checklists_delete_personal on public.checklists;
create policy checklists_delete_personal on public.checklists
  for delete using (
    public.is_trip_member(trip_id, auth.uid())
    and is_shared = false
    and user_id = auth.uid()
  );

-- checklist_items (via parent checklist trip)
drop policy if exists checklist_items_select_member on public.checklist_items;
create policy checklist_items_select_member on public.checklist_items
  for select using (
    exists (
      select 1
      from public.checklists c
      where c.id = checklist_id
        and public.is_trip_member(c.trip_id, auth.uid())
    )
  );

drop policy if exists checklist_items_insert_member on public.checklist_items;
create policy checklist_items_insert_member on public.checklist_items
  for insert with check (
    exists (
      select 1
      from public.checklists c
      where c.id = checklist_id
        and public.is_trip_member(c.trip_id, auth.uid())
    )
  );

drop policy if exists checklist_items_update_member on public.checklist_items;
create policy checklist_items_update_member on public.checklist_items
  for update using (
    exists (
      select 1
      from public.checklists c
      where c.id = checklist_id
        and public.is_trip_member(c.trip_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.checklists c
      where c.id = checklist_id
        and public.is_trip_member(c.trip_id, auth.uid())
    )
  );

drop policy if exists checklist_items_delete_member on public.checklist_items;
create policy checklist_items_delete_member on public.checklist_items
  for delete using (
    exists (
      select 1
      from public.checklists c
      where c.id = checklist_id
        and public.is_trip_member(c.trip_id, auth.uid())
    )
  );

-- Templates: readable by any authenticated user (small reference data)
drop policy if exists checklist_templates_select_auth on public.checklist_templates;
create policy checklist_templates_select_auth on public.checklist_templates
  for select to authenticated using (true);

drop policy if exists checklist_template_items_select_auth on public.checklist_template_items;
create policy checklist_template_items_select_auth on public.checklist_template_items
  for select to authenticated using (true);

-- Seed one default template (idempotent). trip_type must be non-null.
insert into public.checklist_templates (id, name, trip_type)
values (
  '00000000-0000-4000-8000-000000000001',
  'Weekend trip basics',
  'weekend'
)
on conflict (id) do nothing;

insert into public.checklist_template_items (template_id, label, category, sort_order)
select tid, lab, cat, ord
from (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'ID / passport', 'documents', 1),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'Phone charger', 'electronics', 2),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'Toothbrush', 'toiletries', 3),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'Comfortable shoes', 'clothes', 4),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'Reusable water bottle', 'misc', 5)
) as v(tid, lab, cat, ord)
where not exists (
  select 1 from public.checklist_template_items x where x.template_id = v.tid limit 1
);
