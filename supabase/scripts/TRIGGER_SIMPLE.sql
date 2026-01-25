-- ============================================
-- TRIGGER - Guardar metadatos del auth
-- ============================================

-- 1. Primero limpiar duplicados
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as rn
  FROM public.profiles 
  WHERE email IS NOT NULL
)
DELETE FROM public.profiles 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Agregar constraint UNIQUE
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_unique;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- 3. Recrear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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
    seller_tier
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.user_metadata->>'full_name', ''),
    COALESCE(new.user_metadata->>'rut', ''),
    COALESCE(new.user_metadata->>'phone', ''),
    COALESCE(new.user_metadata->>'user_type', 'free'),
    COALESCE(new.user_metadata->>'seller_tier', 'basic')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
