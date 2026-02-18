-- MIGRATION_SUPPORT_TICKET_STATUS_FLOW.sql
-- Reglas de reabrir/cerrar/resolver tickets de soporte + auditoria de estados

-- 1) Nuevas columnas en support_tickets (idempotente)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS closed_reason text NULL;

-- Asegurar datos existentes
UPDATE public.support_tickets
SET reopen_count = 0
WHERE reopen_count IS NULL;

-- 2) Tabla de auditoria de cambios de estado (opcional recomendado)
CREATE TABLE IF NOT EXISTS public.support_ticket_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_status_logs_ticket_id
  ON public.support_ticket_status_logs(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_ticket_status_logs_created_at
  ON public.support_ticket_status_logs(created_at DESC);

-- Opcional: refrescar schema cache de PostgREST
-- notify pgrst, 'reload schema';
