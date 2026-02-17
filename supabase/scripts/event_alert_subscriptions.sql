-- Tabla para alertas de nuevas entradas por evento
create table if not exists public.event_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid not null,
  created_at timestamptz default now()
);

create unique index if not exists event_alert_subscriptions_user_event_key
  on public.event_alert_subscriptions (user_id, event_id);

alter table public.event_alert_subscriptions enable row level security;

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
