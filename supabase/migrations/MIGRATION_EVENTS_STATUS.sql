-- MIGRATION_EVENTS_STATUS.sql
-- Columna status en events

alter table public.events
  add column if not exists status text;

update public.events
  set status = 'published'
  where status is null;

alter table public.events
  alter column status set default 'published';

alter table public.events
  alter column status set not null;

create index if not exists events_status_idx on public.events(status);

-- Opcional: refrescar schema cache de PostgREST
-- notify pgrst, 'reload schema';
