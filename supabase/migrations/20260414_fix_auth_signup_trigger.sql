BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE public.profiles
  ALTER COLUMN user_type SET DEFAULT 'standard',
  ALTER COLUMN seller_tier SET DEFAULT 'basic',
  ALTER COLUMN role SET DEFAULT 'standard';

UPDATE public.profiles
SET user_type = 'standard'
WHERE user_type IS NULL OR user_type = '';

UPDATE public.profiles
SET seller_tier = 'basic'
WHERE seller_tier IS NULL OR seller_tier = '';

UPDATE public.profiles
SET role = COALESCE(NULLIF(role, ''), NULLIF(user_type, ''), 'standard')
WHERE role IS NULL OR role = '';

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL;

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
  v_role text;
  v_status text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_rut := COALESCE(NEW.raw_user_meta_data->>'rut', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  v_user_type := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'user_type', 'standard')));
  IF v_user_type NOT IN ('free', 'standard', 'admin') THEN
    v_user_type := 'standard';
  END IF;

  v_seller_tier := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'seller_tier', 'basic')));
  IF v_seller_tier NOT IN ('basic', 'pro', 'elite') THEN
    v_seller_tier := 'basic';
  END IF;

  v_role := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
    v_user_type,
    'standard'
  );

  v_status := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'status'), ''),
    'online'
  );
  v_status := LOWER(TRIM(v_status));
  IF v_status NOT IN ('online', 'busy', 'away', 'invisible') THEN
    v_status := 'online';
  END IF;

  IF v_rut <> '' THEN
    PERFORM 1
    FROM public.profiles
    WHERE rut = v_rut
      AND id <> NEW.id
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'RUT % ya está registrado en otra cuenta', v_rut;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    rut,
    phone,
    user_type,
    seller_tier,
    role,
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
    v_role,
    false,
    false,
    v_status,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    rut = COALESCE(NULLIF(EXCLUDED.rut, ''), public.profiles.rut),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone),
    user_type = COALESCE(NULLIF(EXCLUDED.user_type, ''), public.profiles.user_type),
    seller_tier = COALESCE(NULLIF(EXCLUDED.seller_tier, ''), public.profiles.seller_tier),
    role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
    status = COALESCE(NULLIF(EXCLUDED.status, ''), public.profiles.status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
