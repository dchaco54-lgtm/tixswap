-- ============================================
-- Migration: Profiles para Community/Chat
-- ============================================
-- Ejecutar en Supabase SQL Editor como admin

-- 1) Agregar columnas a profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text null,
ADD COLUMN IF NOT EXISTS status text not null default 'online' check (status in ('online','busy','away','invisible'));

-- 2) Crear índice único parcial para RUT (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique_not_null 
ON public.profiles (rut) 
WHERE rut IS NOT NULL;

-- 3) Crear bucket 'avatars' en Storage (ejecutar desde UI o SQL si está disponible)
-- En Supabase, esto normalmente se hace vía UI: Storage > New Bucket > 'avatars'
-- Policy: Authenticated users can insert/update/delete in their own folder

-- 4) Ejemplo de policy RLS para bucket avatars (si es necesario ejecutar como SQL):
-- Para ejecutar esto, necesitas acceso a storage.objects
-- CREATE POLICY "Users can manage their own avatar"
-- ON storage.objects FOR ALL
-- USING ( bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1] );

-- ============================================
-- Notas:
-- - avatar_url: URL pública generada tras upload
-- - status: online|busy|away|invisible (default online)
-- - Índice RUT: permite NULL duplicados pero evita duplicados en valores no-null
-- ============================================
