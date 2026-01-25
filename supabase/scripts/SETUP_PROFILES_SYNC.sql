-- ============================================
-- SINCRONIZACIÓN COMPLETA: Web <-> Supabase
-- Ejecutar TODO en Supabase SQL Editor
-- ============================================

-- PASO 1: Asegurar estructura de profiles con defaults correctos
ALTER TABLE public.profiles
  ALTER COLUMN user_type SET DEFAULT 'standard',
  ALTER COLUMN seller_tier SET DEFAULT 'basic';

-- Actualizar filas existentes sin tier/user_type
UPDATE public.profiles 
SET seller_tier = 'basic' 
WHERE seller_tier IS NULL OR seller_tier = '';

UPDATE public.profiles 
SET user_type = 'standard' 
WHERE user_type IS NULL OR user_type = '';

-- PASO 2: Constraints de unicidad
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles(email);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique ON public.profiles(rut) 
  WHERE rut IS NOT NULL AND rut <> '';

-- PASO 3: Función trigger robusta que sincroniza auth.users -> profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_rut text;
  v_phone text;
  v_user_type text;
  v_seller_tier text;
BEGIN
  -- Extraer datos de metadata desde raw_user_meta_data
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    ''
  );
  
  v_rut := COALESCE(
    NEW.raw_user_meta_data->>'rut',
    ''
  );
  
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    ''
  );
  
  v_user_type := COALESCE(
    NEW.raw_user_meta_data->>'user_type',
    'standard'
  );
  
  v_seller_tier := COALESCE(
    NEW.raw_user_meta_data->>'seller_tier',
    'basic'
  );

  -- Validar que RUT no exista en otra cuenta
  IF v_rut <> '' THEN
    PERFORM 1 FROM public.profiles 
    WHERE rut = v_rut AND id <> NEW.id 
    LIMIT 1;
    
    IF FOUND THEN
      RAISE EXCEPTION 'RUT % ya está registrado en otra cuenta', v_rut;
    END IF;
  END IF;

  -- Upsert en profiles (idempotente)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    rut,
    phone,
    user_type,
    seller_tier,
    is_blocked,
    seller_tier_locked,
    status,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_rut,
    v_phone,
    v_user_type,
    v_seller_tier,
    false,
    false,
    'online',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    rut = COALESCE(NULLIF(EXCLUDED.rut, ''), public.profiles.rut),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone),
    user_type = COALESCE(NULLIF(EXCLUDED.user_type, ''), public.profiles.user_type),
    seller_tier = COALESCE(NULLIF(EXCLUDED.seller_tier, ''), public.profiles.seller_tier);

  RETURN NEW;
END;
$$;

-- PASO 4: Crear/Recrear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();



-- PASO 6: Verificar todo
SELECT 
  'Trigger creado' as status,
  COUNT(*) as count
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name = 'on_auth_user_created';

SELECT 
  'Realtime habilitado' as status,
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'profiles';

-- ============================================
-- LISTO ✅
-- Ahora cada signup crea/actualiza profiles automáticamente
-- Y los cambios en profiles se transmiten en tiempo real
-- ============================================
