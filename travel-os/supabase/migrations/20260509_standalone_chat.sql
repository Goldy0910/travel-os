-- ============================================================
-- Standalone AI chat (user-owned, not trip-scoped)
-- Isolated from trip group chat (`messages`) and trip AI (`ai_conversations`)
-- ============================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint conversation_messages_role_check
    check (role in ('user', 'assistant', 'system'))
);

create index if not exists conversation_messages_conversation_created_idx
  on public.conversation_messages (conversation_id, created_at asc);

create or replace function public.set_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_conversations_updated_at on public.conversations;

create trigger trg_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_conversations_updated_at();

-- Bump conversation.updated_at when a message is inserted
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_message on public.conversation_messages;

create trigger trg_touch_conversation_on_message
after insert on public.conversation_messages
for each row
execute function public.touch_conversation_on_message();

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists conversations_select_own on public.conversations;
drop policy if exists conversations_insert_own on public.conversations;
drop policy if exists conversations_update_own on public.conversations;
drop policy if exists conversations_delete_own on public.conversations;

create policy conversations_select_own on public.conversations
  for select using (user_id = auth.uid());

create policy conversations_insert_own on public.conversations
  for insert with check (user_id = auth.uid());

create policy conversations_update_own on public.conversations
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy conversations_delete_own on public.conversations
  for delete using (user_id = auth.uid());

drop policy if exists conversation_messages_select_own on public.conversation_messages;
drop policy if exists conversation_messages_insert_own on public.conversation_messages;
drop policy if exists conversation_messages_update_own on public.conversation_messages;
drop policy if exists conversation_messages_delete_own on public.conversation_messages;

create policy conversation_messages_select_own on public.conversation_messages
  for select using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy conversation_messages_insert_own on public.conversation_messages
  for insert with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy conversation_messages_update_own on public.conversation_messages
  for update using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy conversation_messages_delete_own on public.conversation_messages
  for delete using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
