-- ============================================
-- MIGRATION: Agregar campos de onboarding
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Agregar campos para tracking de onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS profiles_onboarding_done_idx ON public.profiles(onboarding_done);

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.onboarding_done IS 'Indica si el usuario completó o saltó el onboarding inicial';
COMMENT ON COLUMN public.profiles.onboarding_skipped_at IS 'Timestamp cuando el usuario saltó el onboarding';
COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 'Timestamp cuando el usuario completó el onboarding';

-- Verificar estructura
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('onboarding_done', 'onboarding_skipped_at', 'onboarding_completed_at')
ORDER BY ordinal_position;

-- ============================================
-- LISTO ✅
-- Ahora la tabla profiles tiene campos para tracking de onboarding
-- ============================================
