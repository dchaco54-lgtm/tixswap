-- ============================================
-- FIX: Agregar columna 'role' como alias de 'user_type'
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Opción 1: Crear vista que incluya 'role'
CREATE OR REPLACE VIEW profiles_with_role AS
SELECT 
  *,
  user_type as role
FROM public.profiles;

-- Opción 2 (RECOMENDADO): Simplemente usar user_type en queries
-- No agregar columna role, actualizar el código para usar user_type

-- ============================================
-- VERIFICAR: ¿Hay alguna vista que use profiles.role?
-- ============================================
SELECT table_name, view_definition 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND view_definition LIKE '%role%';
