-- Logs de cambios de eventos + rate limit de emails

create table if not exists public.event_change_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  changed_by_admin_id uuid null references public.profiles(id) on delete set null,
  change_type text not null,
  change_type_detail text null,
  message_to_users text null,
  old_values jsonb not null,
  new_values jsonb not null,
  changed_fields text[] not null,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists event_change_logs_event_created_idx
  on public.event_change_logs (event_id, created_at desc);

alter table public.event_change_logs enable row level security;

-- Solo admins pueden leer/insertar (service role bypassa RLS)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_change_logs'
      and policyname = 'event_change_logs_admin_select'
  ) then
    create policy event_change_logs_admin_select
      on public.event_change_logs
      for select
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and (
              p.user_type = 'admin'
              or p.app_role = 'admin'
              or p.role = 'admin'
            )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_change_logs'
      and policyname = 'event_change_logs_admin_insert'
  ) then
    create policy event_change_logs_admin_insert
      on public.event_change_logs
      for insert
      with check (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and (
              p.user_type = 'admin'
              or p.app_role = 'admin'
              or p.role = 'admin'
            )
        )
      );
  end if;
end $$;

create table if not exists public.event_update_email_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

create unique index if not exists event_update_email_log_event_user_key
  on public.event_update_email_log (event_id, user_id);

alter table public.event_update_email_log enable row level security;
-- Sin policies: solo service role.
