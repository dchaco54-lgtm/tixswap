-- ============================================
-- Migration: Consolidate user_type and seller_tier schema
-- ============================================
-- Ejecutar en Supabase SQL Editor como admin

BEGIN;

-- 1) Verificar si existen las columnas actuales
-- Si tienes 'role', 'tier', 'tier_locked' → rename
-- Si tienes 'user_type', 'seller_tier', 'seller_tier_locked' → ya está hecho

-- OPCIÓN A: Si aún existen las columnas viejas (role, tier, tier_locked)
-- Descomenta esto si lo necesitas:

-- ALTER TABLE public.profiles
-- RENAME COLUMN role TO user_type;

-- ALTER TABLE public.profiles
-- RENAME COLUMN tier TO seller_tier;

-- ALTER TABLE public.profiles
-- RENAME COLUMN tier_locked TO seller_tier_locked;


-- OPCIÓN B: Si necesitas agregar las columnas nuevas (porque aún no existen)
-- Descomenta esto:

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'standard' 
    CHECK (user_type IN ('free', 'standard', 'admin'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_tier text NOT NULL DEFAULT 'basic'
    CHECK (seller_tier IN ('basic', 'pro', 'elite'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_tier_locked boolean NOT NULL DEFAULT false;

-- 3) Si existen las columnas viejas (role, tier, tier_locked), hacer migración de datos
-- Descomenta si lo necesitas:

-- UPDATE public.profiles SET user_type = 'free' WHERE role = 'free' OR role IS NULL;
-- UPDATE public.profiles SET user_type = 'standard' WHERE role IN ('standard', 'basic', 'pro');
-- UPDATE public.profiles SET user_type = 'admin' WHERE role = 'admin';

-- UPDATE public.profiles SET seller_tier = 'basic' WHERE tier = 'free' OR tier = 'basic' OR tier IS NULL;
-- UPDATE public.profiles SET seller_tier = 'pro' WHERE tier = 'pro';
-- UPDATE public.profiles SET seller_tier = 'elite' WHERE tier IN ('elite', 'premium', 'ultra');

-- 4) Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type 
  ON public.profiles(user_type);

CREATE INDEX IF NOT EXISTS idx_profiles_seller_tier 
  ON public.profiles(seller_tier);

CREATE INDEX IF NOT EXISTS idx_profiles_seller_tier_locked 
  ON public.profiles(seller_tier_locked);

-- 5) Actualizar comentarios
COMMENT ON COLUMN public.profiles.user_type IS 'Tipo de usuario: free | standard | admin';
COMMENT ON COLUMN public.profiles.seller_tier IS 'Nivel de vendedor para comisiones: basic | pro | elite';
COMMENT ON COLUMN public.profiles.seller_tier_locked IS 'Si el seller_tier está fijado por admin (no auto-calculado)';

COMMIT;

-- ============================================
-- Notas de ejecución:
-- 
-- 1. Si la BD ya tiene 'user_type', 'seller_tier', 'seller_tier_locked':
--    → Solo ejecuta las partes de índices y comentarios
--
-- 2. Si la BD aún tiene 'role', 'tier', 'tier_locked':
--    → Ejecuta OPCIÓN A (rename)
--    → Luego ejecuta la migración de datos
--
-- 3. Si la BD no tiene NINGUNA (ni vieja ni nueva):
--    → Ejecuta OPCIÓN B (add columns)
--
-- 4. Verificar después:
--    SELECT id, user_type, seller_tier, seller_tier_locked 
--    FROM public.profiles LIMIT 5;
-- ============================================
