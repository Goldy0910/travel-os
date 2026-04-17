create table if not exists public.destination_visa_guides (
  id uuid primary key default gen_random_uuid(),
  destination_key text not null unique,
  destination_display text not null,
  visa_type text not null,
  stay text not null,
  cost text not null,
  processing_time text not null,
  apply_link text not null,
  checklist_salaried jsonb not null default '[]'::jsonb,
  checklist_self_employed jsonb not null default '[]'::jsonb,
  checklist_student jsonb not null default '[]'::jsonb,
  recommendations_before_apply jsonb not null default '[]'::jsonb,
  recommendations_while_applying jsonb not null default '[]'::jsonb,
  recommendations_after_apply jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  model text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists destination_visa_guides_destination_key_idx
  on public.destination_visa_guides (destination_key);

alter table public.destination_visa_guides enable row level security;

drop policy if exists destination_visa_guides_select on public.destination_visa_guides;
create policy destination_visa_guides_select on public.destination_visa_guides
  for select to authenticated using (true);

drop policy if exists destination_visa_guides_insert on public.destination_visa_guides;
create policy destination_visa_guides_insert on public.destination_visa_guides
  for insert to authenticated with check (true);

drop policy if exists destination_visa_guides_update on public.destination_visa_guides;
create policy destination_visa_guides_update on public.destination_visa_guides
  for update to authenticated using (true) with check (true);
