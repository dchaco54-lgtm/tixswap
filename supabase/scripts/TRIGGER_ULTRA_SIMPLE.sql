-- ============================================
-- TRIGGER COMPLETO - Con todos los metadatos
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Crear función que guarda TODOS los metadatos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Si falla (duplicado, etc), simplemente continuar
    NULL;
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verificar
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_schema = 'public' AND trigger_name = 'on_auth_user_created';
