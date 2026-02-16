-- Asegurar default para support_tickets.ticket_number (produccion)
-- Ejecutar en Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'support_ticket_number_seq'
  ) THEN
    CREATE SEQUENCE public.support_ticket_number_seq;
  END IF;
END $$;

ALTER SEQUENCE public.support_ticket_number_seq
  OWNED BY public.support_tickets.ticket_number;

ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_number SET DEFAULT nextval('public.support_ticket_number_seq'::regclass);

SELECT setval(
  'public.support_ticket_number_seq',
  COALESCE((SELECT MAX(ticket_number) FROM public.support_tickets), 1000)
);
