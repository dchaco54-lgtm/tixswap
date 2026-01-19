-- ============================================
-- INSPECCIÓN: Verificar estructura actual de profiles
-- ============================================
-- Ejecuta esto en Supabase SQL Editor para ver qué tiene la BD

-- 1. Ver todas las columnas de la tabla profiles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver constraints (CHECK, FK, etc)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'profiles' AND table_schema = 'public';

-- 3. Ver algunos datos de ejemplo (solo las columnas que existan)
SELECT 
  id,
  email,
  full_name,
  user_type,
  seller_tier,
  seller_tier_locked,
  is_blocked,
  created_at
FROM public.profiles
LIMIT 5;

-- 4. Contar cuántos usuarios hay por tipo/tier (si existen las columnas)
-- SELECT user_type, COUNT(*) as count FROM public.profiles GROUP BY user_type;
-- SELECT seller_tier, COUNT(*) as count FROM public.profiles GROUP BY seller_tier;
