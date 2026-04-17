alter table public.destination_visa_guides
  add column if not exists cost_source_link text;

update public.destination_visa_guides
set cost_source_link = coalesce(nullif(cost_source_link, ''), apply_link)
where cost_source_link is null or cost_source_link = '';
