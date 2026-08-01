-- ============================================================
-- Conversation memory (chat-scoped only — not linked to trips)
-- ============================================================

create table if not exists public.conversation_memory (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  preferred_destination text null,
  budget text null,
  travel_dates text null,
  group_size text null,
  interests jsonb not null default '[]'::jsonb,
  food_preferences jsonb not null default '[]'::jsonb,
  transport_preference text null,
  updated_at timestamptz not null default now(),
  constraint conversation_memory_interests_is_array
    check (jsonb_typeof(interests) = 'array'),
  constraint conversation_memory_food_preferences_is_array
    check (jsonb_typeof(food_preferences) = 'array')
);

create or replace function public.set_conversation_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_conversation_memory_updated_at on public.conversation_memory;

create trigger trg_conversation_memory_updated_at
before update on public.conversation_memory
for each row
execute function public.set_conversation_memory_updated_at();

alter table public.conversation_memory enable row level security;

drop policy if exists conversation_memory_select_own on public.conversation_memory;
drop policy if exists conversation_memory_insert_own on public.conversation_memory;
drop policy if exists conversation_memory_update_own on public.conversation_memory;
drop policy if exists conversation_memory_delete_own on public.conversation_memory;

create policy conversation_memory_select_own on public.conversation_memory
  for select using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_memory.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy conversation_memory_insert_own on public.conversation_memory
  for insert with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_memory.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy conversation_memory_update_own on public.conversation_memory
  for update using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_memory.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_memory.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy conversation_memory_delete_own on public.conversation_memory
  for delete using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_memory.conversation_id
        and c.user_id = auth.uid()
    )
  );
