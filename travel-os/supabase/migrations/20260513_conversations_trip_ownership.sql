-- ============================================================
-- Trip-owned conversations (1:1)
-- - conversations.trip_id nullable (NULL = standalone chat)
-- - unique: each trip has at most one conversation
-- - backfill from existing trips.conversation_id (preserves history)
-- ============================================================

alter table if exists public.conversations
  add column if not exists trip_id uuid null
    references public.trips (id) on delete set null;

comment on column public.conversations.trip_id is
  'When set, this conversation belongs to the trip (exactly one per trip). NULL = standalone chat.';

-- One conversation per trip
create unique index if not exists conversations_trip_id_unique
  on public.conversations (trip_id)
  where trip_id is not null;

create index if not exists conversations_trip_id_idx
  on public.conversations (trip_id)
  where trip_id is not null;

-- One trip per conversation (strengthen existing link)
create unique index if not exists trips_conversation_id_unique
  on public.trips (conversation_id)
  where conversation_id is not null;

-- Backfill: attach conversations already linked from trips.conversation_id
-- Prefer earliest trip if multiple rows incorrectly share a conversation_id.
with ranked as (
  select
    t.id as trip_id,
    t.conversation_id,
    row_number() over (
      partition by t.conversation_id
      order by t.id asc
    ) as rn
  from public.trips t
  where t.conversation_id is not null
)
update public.conversations c
set trip_id = ranked.trip_id
from ranked
where ranked.rn = 1
  and ranked.conversation_id = c.id
  and c.trip_id is null;

-- Sync trips.conversation_id when conversation already has trip_id but trip link is missing
update public.trips t
set conversation_id = c.id
from public.conversations c
where c.trip_id = t.id
  and (t.conversation_id is null or t.conversation_id <> c.id);

-- RLS: trip members can read the trip's conversation (owner policies remain)
drop policy if exists conversations_select_trip_member on public.conversations;
create policy conversations_select_trip_member on public.conversations
  for select
  using (
    trip_id is not null
    and exists (
      select 1
      from public.members m
      where m.trip_id = conversations.trip_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists conversation_messages_select_trip_member on public.conversation_messages;
create policy conversation_messages_select_trip_member on public.conversation_messages
  for select
  using (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_messages.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );

drop policy if exists conversation_messages_insert_trip_member on public.conversation_messages;
create policy conversation_messages_insert_trip_member on public.conversation_messages
  for insert
  with check (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_messages.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );

drop policy if exists conversation_messages_update_trip_member on public.conversation_messages;
create policy conversation_messages_update_trip_member on public.conversation_messages
  for update
  using (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_messages.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_messages.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );

drop policy if exists conversation_messages_delete_trip_member on public.conversation_messages;
create policy conversation_messages_delete_trip_member on public.conversation_messages
  for delete
  using (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_messages.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );

-- Memory readable by trip members
drop policy if exists conversation_memory_select_trip_member on public.conversation_memory;
create policy conversation_memory_select_trip_member on public.conversation_memory
  for select
  using (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_memory.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );

drop policy if exists conversation_memory_insert_trip_member on public.conversation_memory;
create policy conversation_memory_insert_trip_member on public.conversation_memory
  for insert
  with check (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_memory.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );

drop policy if exists conversation_memory_update_trip_member on public.conversation_memory;
create policy conversation_memory_update_trip_member on public.conversation_memory
  for update
  using (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_memory.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      join public.members m on m.trip_id = c.trip_id
      where c.id = conversation_memory.conversation_id
        and c.trip_id is not null
        and m.user_id = auth.uid()
    )
  );
