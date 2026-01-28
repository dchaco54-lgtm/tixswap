-- ============================================
-- MIGRACIÓN: Extender ticket_uploads con campos de validación PDF
-- ============================================
-- EJECUTAR EN: Supabase SQL Editor
-- FECHA: 2026-01-21
-- ============================================

-- 1. Agregar columnas de metadata del ticket (15 nuevas columnas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_uploads' AND column_name = 'provider') THEN
    ALTER TABLE public.ticket_uploads
    ADD COLUMN provider text,
    ADD COLUMN ticket_number text,
    ADD COLUMN order_number text,
    ADD COLUMN event_name text,
    ADD COLUMN event_datetime timestamptz,
    ADD COLUMN venue text,
    ADD COLUMN sector text,
    ADD COLUMN category text,
    ADD COLUMN attendee_name text,
    ADD COLUMN attendee_rut text,
    ADD COLUMN producer_name text,
    ADD COLUMN producer_rut text,
    ADD COLUMN qr_payload text,
    ADD COLUMN validation_status text DEFAULT 'validated' CHECK (validation_status IN ('validated', 'rejected', 'review')),
    ADD COLUMN validation_reason text;
    RAISE NOTICE 'Columnas de validación agregadas a ticket_uploads';
  ELSE
    RAISE NOTICE 'Columnas ya existen, saltando...';
  END IF;
END $$;

-- 2. Crear índice único por (provider, ticket_number) para prevenir duplicados reales
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_uploads_provider_number_unique') THEN
    CREATE UNIQUE INDEX idx_ticket_uploads_provider_number_unique 
    ON public.ticket_uploads(provider, ticket_number) 
    WHERE ticket_number IS NOT NULL;
    RAISE NOTICE 'Índice único (provider, ticket_number) creado';
  ELSE
    RAISE NOTICE 'Índice único ya existe';
  END IF;
END $$;

-- 3. Crear índices para performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_uploads_order_number') THEN
    CREATE INDEX idx_ticket_uploads_order_number ON public.ticket_uploads(order_number);
    RAISE NOTICE 'Índice order_number creado';
  ELSE
    RAISE NOTICE 'Índice order_number ya existe';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_uploads_event_datetime') THEN
    CREATE INDEX idx_ticket_uploads_event_datetime ON public.ticket_uploads(event_datetime);
    RAISE NOTICE 'Índice event_datetime creado';
  ELSE
    RAISE NOTICE 'Índice event_datetime ya existe';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_uploads_validation_status') THEN
    CREATE INDEX idx_ticket_uploads_validation_status ON public.ticket_uploads(validation_status);
    RAISE NOTICE 'Índice validation_status creado';
  ELSE
    RAISE NOTICE 'Índice validation_status ya existe';
  END IF;
END $$;

-- 4. Verificación: mostrar estructura actualizada
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ticket_uploads'
ORDER BY ordinal_position;

-- 5. Verificación: contar índices
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'ticket_uploads'
  AND (indexname LIKE '%provider%' OR indexname LIKE '%order%' OR indexname LIKE '%event%' OR indexname LIKE '%validation%')
ORDER BY indexname;
