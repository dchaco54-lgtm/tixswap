-- ============================================
-- Migration: Agregar columnas faltantes (seller_tier_locked, status)
-- ============================================
-- Estado actual: user_type y seller_tier YA EXISTEN
-- Faltante: seller_tier_locked, status

BEGIN;

-- 1) Agregar seller_tier_locked (para admin que fije el tier)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_tier_locked boolean NOT NULL DEFAULT false;

-- 2) Agregar status (estado de disponibilidad)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'online'
  CHECK (status IN ('online', 'busy', 'away', 'invisible'));

-- 3) Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_seller_tier_locked 
  ON public.profiles(seller_tier_locked);

CREATE INDEX IF NOT EXISTS idx_profiles_status 
  ON public.profiles(status);

-- 4) Actualizar comentarios
COMMENT ON COLUMN public.profiles.seller_tier_locked IS 'Si el seller_tier está fijado por admin (no auto-calculado)';
COMMENT ON COLUMN public.profiles.status IS 'Estado de disponibilidad: online|busy|away|invisible';

-- 5) Verificar que todo quedó correcto
-- SELECT id, user_type, seller_tier, seller_tier_locked, status FROM public.profiles LIMIT 5;

COMMIT;
