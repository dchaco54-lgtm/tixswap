-- Asegurar default para support_tickets.ticket_number (produccion)
-- Ejecutar en Supabase SQL Editor

DO $$
DECLARE
  default_expr text;
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

  SELECT column_default
    INTO default_expr
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'support_tickets'
    AND column_name = 'ticket_number';

  IF default_expr IS NULL THEN
    ALTER TABLE public.support_tickets
      ALTER COLUMN ticket_number SET DEFAULT nextval('public.support_ticket_number_seq'::regclass);
  ELSE
    IF position('support_ticket_number_seq' in default_expr) = 0 THEN
      RAISE NOTICE 'ticket_number default ya existe (%). No se cambia.', default_expr;
    END IF;
  END IF;
END $$;

ALTER SEQUENCE public.support_ticket_number_seq
  OWNED BY public.support_tickets.ticket_number;

SELECT setval(
  'public.support_ticket_number_seq',
  COALESCE((SELECT MAX(ticket_number) FROM public.support_tickets), 1000)
);

SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'support_tickets'
  AND column_name = 'ticket_number';
