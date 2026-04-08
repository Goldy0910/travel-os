-- Speed up Trip Details tab queries (itinerary, expenses, chat, docs, members).
-- Uses IF NOT EXISTS so repeated deploys remain safe.

create index if not exists members_user_id_trip_id_idx
  on public.members (user_id, trip_id);

create index if not exists members_trip_id_user_id_idx
  on public.members (trip_id, user_id);

create index if not exists members_trip_id_created_at_idx
  on public.members (trip_id, created_at);

create index if not exists itinerary_days_trip_id_date_idx
  on public.itinerary_days (trip_id, date);

create index if not exists itinerary_items_trip_id_date_time_idx
  on public.itinerary_items (trip_id, date, time);

create index if not exists expenses_trip_id_date_idx
  on public.expenses (trip_id, date);

create index if not exists expense_participants_expense_id_user_id_idx
  on public.expense_participants (expense_id, user_id);

create index if not exists comments_trip_id_entity_type_created_at_idx
  on public.comments (trip_id, entity_type, created_at);

create index if not exists messages_trip_id_created_at_idx
  on public.messages (trip_id, created_at);

create index if not exists documents_trip_id_created_at_idx
  on public.documents (trip_id, created_at);
