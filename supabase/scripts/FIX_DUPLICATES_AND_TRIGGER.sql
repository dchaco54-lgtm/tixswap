-- -- ============================================
-- FIX: Limpiar duplicados y arreglar trigger
-- Ejecutar paso a paso en Supabase SQL Editor
-- ============================================

-- PASO 1: Ver duplicados
-- SELECT email, COUNT(*) as count 
-- FROM public.profiles 
-- WHERE email IS NOT NULL 
-- GROUP BY email 
-- HAVING COUNT(*) > 1;

-- PASO 2: Eliminar duplicados (mantener el MÁS ANTIGUO)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as rn
  FROM public.profiles 
  WHERE email IS NOT NULL
)
DELETE FROM public.profiles 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- PASO 3: Eliminar el constraint viejo si existe
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_unique;

-- PASO 4: Agregar constraint UNIQUE en email
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- PASO 5: Recrear trigger (versión simplificada)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    rut,
    phone,
    user_type,
    seller_tier,
    status,
    is_blocked,
    created_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.user_metadata->>'full_name', ''),
    COALESCE(new.user_metadata->>'rut', ''),
    COALESCE(new.user_metadata->>'phone', ''),
    COALESCE(new.user_metadata->>'user_type', 'free'),
    COALESCE(new.user_metadata->>'seller_tier', 'basic'),
    'online',
    false,
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PASO 6: Recrear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
