-- ============================================
-- Trigger: Crear perfil automáticamente en auth.users→profiles
-- ============================================

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
    COALESCE((new.user_metadata->>'full_name')::text, ''),
    COALESCE((new.user_metadata->>'rut')::text, ''),
    COALESCE((new.user_metadata->>'phone')::text, ''),
    COALESCE((new.user_metadata->>'user_type')::text, 'free'),
    COALESCE((new.user_metadata->>'seller_tier')::text, 'basic'),
    'online',
    false,
    now()
  )
  ON CONFLICT (email) DO NOTHING;  -- Evitar duplicados por email
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Agregar constraint UNIQUE en email para evitar duplicados
-- ============================================
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON FUNCTION public.handle_new_user() IS 'Crea un perfil en profiles cuando se registra un usuario en auth';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Trigger para crear profiles automáticamente en signup';

