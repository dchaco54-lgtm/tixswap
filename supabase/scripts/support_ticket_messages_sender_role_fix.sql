-- Fix NOT NULL sender_role/sender_type/message in support_ticket_messages (idempotente)
-- Ejecutar en Supabase SQL Editor

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_ticket_messages'
      AND column_name = 'sender_role'
  ) THEN
    ALTER TABLE public.support_ticket_messages
      ALTER COLUMN sender_role SET DEFAULT 'user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_ticket_messages'
      AND column_name = 'sender_type'
  ) THEN
    ALTER TABLE public.support_ticket_messages
      ALTER COLUMN sender_type SET DEFAULT 'user';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.support_ticket_messages_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.sender_role IS NULL THEN
    NEW.sender_role := COALESCE(NEW.sender_type, 'user');
  END IF;
  IF NEW.sender_type IS NULL THEN
    NEW.sender_type := COALESCE(NEW.sender_role, 'user');
  END IF;
  IF NEW.message IS NULL THEN
    NEW.message := NEW.body;
  END IF;
  IF NEW.body IS NULL THEN
    NEW.body := NEW.message;
  END IF;
  IF NEW.message IS NULL THEN
    NEW.message := '';
  END IF;
  IF NEW.body IS NULL THEN
    NEW.body := '';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'support_ticket_messages'
  ) THEN
    DROP TRIGGER IF EXISTS trg_support_ticket_messages_default_sender_role
      ON public.support_ticket_messages;
    CREATE TRIGGER trg_support_ticket_messages_default_sender_role
    BEFORE INSERT ON public.support_ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.support_ticket_messages_defaults();
  END IF;
END $$;
