-- ============================================
-- TEST MANUAL DEL TRIGGER
-- Ejecutar línea por línea en Supabase SQL Editor
-- ============================================

-- 1. Primero, verificar que la función y trigger existen
SELECT tgname, tgisinternal
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

SELECT proname, prosrc
FROM pg_proc 
WHERE proname = 'handle_new_user'
LIMIT 1;

-- 2. Verificar que la tabla tiene los datos correctos
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. TEST: Insertar usuario de prueba directamente en auth.users
-- (Esto simula lo que hace el signup)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test_trigger_' || to_char(now(), 'YYYYMMDDHH24MISS') || '@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  null,
  '',
  now(),
  '',
  now(),
  '',
  '',
  now(),
  now(),
  '{}',
  jsonb_build_object(
    'full_name', 'Test User',
    'rut', '12.345.678-9',
    'phone', '+56912345678',
    'user_type', 'standard',
    'seller_tier', 'basic'
  ),
  false,
  now(),
  now(),
  null,
  null,
  '',
  '',
  now()
);

-- 4. Verificar que se creó en profiles
SELECT id, email, full_name, rut, phone, user_type, seller_tier, is_blocked, status
FROM public.profiles
WHERE email LIKE 'test_trigger_%'
ORDER BY created_at DESC
LIMIT 1;

-- 5. Si el INSERT anterior falla, muestra el error aquí ⬆️
-- Si llegó aquí sin error, el trigger funciona ✅
