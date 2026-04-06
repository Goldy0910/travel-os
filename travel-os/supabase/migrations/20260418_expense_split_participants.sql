-- Expense split upgrade (beta): participant-level split details

alter table public.expenses
  add column if not exists created_by uuid,
  add column if not exists paid_by_user_id uuid,
  add column if not exists description text;

update public.expenses
set created_by = coalesce(created_by, user_id)
where created_by is null;

alter table public.expenses
  alter column created_by set default auth.uid();

create table if not exists public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null,
  split_value numeric(12,2) not null default 0,
  split_type text not null check (split_type in ('amount', 'percentage')),
  computed_amount numeric(12,2) not null default 0,
  owes_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index if not exists expense_participants_expense_id_idx
  on public.expense_participants(expense_id);

create index if not exists expenses_paid_by_user_id_idx
  on public.expenses(paid_by_user_id);

alter table public.expense_participants enable row level security;

drop policy if exists expense_participants_select_member on public.expense_participants;
create policy expense_participants_select_member on public.expense_participants
  for select using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_participants.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );

drop policy if exists expense_participants_insert_member on public.expense_participants;
create policy expense_participants_insert_member on public.expense_participants
  for insert with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_participants.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );

drop policy if exists expense_participants_update_member on public.expense_participants;
create policy expense_participants_update_member on public.expense_participants
  for update using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_participants.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_participants.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );

drop policy if exists expense_participants_delete_member on public.expense_participants;
create policy expense_participants_delete_member on public.expense_participants
  for delete using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_participants.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );
