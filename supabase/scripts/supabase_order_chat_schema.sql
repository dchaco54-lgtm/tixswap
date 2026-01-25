-- Tabla para mensajes entre comprador y vendedor por orden
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  attachment_url text,
  attachment_name text,
  created_at timestamptz default now()
);

-- Índices para performance
create index if not exists idx_order_messages_order_id on public.order_messages(order_id);
create index if not exists idx_order_messages_created_at on public.order_messages(created_at desc);

-- RLS: solo comprador y vendedor pueden ver/crear mensajes de su orden
alter table public.order_messages enable row level security;

create policy "Users can view messages from their orders"
  on public.order_messages for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id
        and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

create policy "Users can create messages in their orders"
  on public.order_messages for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id
        and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    and sender_id = auth.uid()
  );

-- Comentario
comment on table public.order_messages is 'Mensajes entre comprador y vendedor por orden';
