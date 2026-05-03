-- Legacy Visa tool table (unused by current app code). Safe to drop after migration runs.

drop policy if exists destination_visa_guides_select on public.destination_visa_guides;
drop policy if exists destination_visa_guides_insert on public.destination_visa_guides;
drop policy if exists destination_visa_guides_update on public.destination_visa_guides;

drop table if exists public.destination_visa_guides;
