-- 1. Ver si el trigger existe
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'on_auth_user_created';

-- 2. Ver RLS policies en profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 3. Ver si RLS está habilitado en profiles
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'profiles' AND schemaname = 'public';

-- 4. Test simple: crear profile manualmente
-- INSERT INTO public.profiles (id, email) VALUES (gen_random_uuid(), 'test_trigger@example.com');
