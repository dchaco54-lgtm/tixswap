-- RLS para support_ticket_messages (idempotente)
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_ticket_messages_insert_own ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_insert_own
ON public.support_ticket_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id
      AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS support_ticket_messages_select_own ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_select_own
ON public.support_ticket_messages
FOR SELECT
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id
      AND t.user_id = auth.uid()
  )
);
