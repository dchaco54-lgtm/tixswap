-- Tabla: suscripciones a alertas por evento
create table if not exists public.event_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz default now(),
  last_notified_at timestamptz null,
  constraint event_alert_subscriptions_user_event_key unique (user_id, event_id)
);

create index if not exists event_alert_subscriptions_event_id_idx
  on public.event_alert_subscriptions (event_id);

alter table public.event_alert_subscriptions enable row level security;

-- RLS: cada usuario solo ve/crea/borra lo suyo

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_alert_subscriptions'
      and policyname = 'event_alert_subscriptions_select'
  ) then
    create policy event_alert_subscriptions_select
      on public.event_alert_subscriptions
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_alert_subscriptions'
      and policyname = 'event_alert_subscriptions_insert'
  ) then
    create policy event_alert_subscriptions_insert
      on public.event_alert_subscriptions
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_alert_subscriptions'
      and policyname = 'event_alert_subscriptions_delete'
  ) then
    create policy event_alert_subscriptions_delete
      on public.event_alert_subscriptions
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Refrescar schema cache de PostgREST
notify pgrst, 'reload schema';
