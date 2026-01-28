-- ============================================
-- MIGRATION: Campos de Onboarding en Profiles
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar campos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Crear índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON public.profiles(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_email_confirmed ON public.profiles(email_confirmed);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_dismissed_at ON public.profiles(onboarding_dismissed_at);

-- 3. Comentarios para documentación
COMMENT ON COLUMN public.profiles.email_confirmed IS 'Indica si el usuario confirmó su correo';
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Indica si el usuario completó el onboarding inicial';
COMMENT ON COLUMN public.profiles.onboarding_dismissed_at IS 'Timestamp cuando el usuario dismissó el onboarding (rate limit 1x/día)';
COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 'Timestamp cuando el usuario completó el onboarding';

-- 4. Verificar que los campos fueron creados
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('email_confirmed', 'onboarding_completed', 'onboarding_dismissed_at', 'onboarding_completed_at')
ORDER BY column_name;

-- ============================================
-- LISTO ✅
-- Campos agregados correctamente
-- ============================================
