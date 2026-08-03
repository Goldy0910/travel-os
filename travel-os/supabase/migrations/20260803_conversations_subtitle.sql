-- Optional subtitle for conversation list (theme / trip summary).
-- Title remains the primary place/destination name.

alter table if exists public.conversations
  add column if not exists subtitle text;

comment on column public.conversations.subtitle is
  'Short theme/summary line for the chat sidebar; derived from conversation memory (not LLM).';
