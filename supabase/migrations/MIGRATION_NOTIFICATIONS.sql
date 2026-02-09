-- Notifications (MVP)
-- Nota: Service Role bypassa RLS; se deja policy de INSERT para casos client-side.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text null,
  link text null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_is_read_idx
  on public.notifications (user_id, is_read);

alter table if exists public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Notifications select own'
  ) then
    create policy "Notifications select own"
      on public.notifications
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Notifications update own'
  ) then
    create policy "Notifications update own"
      on public.notifications
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Notifications insert own'
  ) then
    create policy "Notifications insert own"
      on public.notifications
      for insert
      with check (user_id = auth.uid());
  end if;
end $$;
