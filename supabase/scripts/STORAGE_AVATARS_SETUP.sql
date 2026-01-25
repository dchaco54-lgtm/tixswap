-- ============================================
-- CREAR BUCKET PARA AVATARS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Crear bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB en bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: permitir a usuarios autenticados SUBIR sus propios avatars
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Política: permitir a usuarios autenticados ACTUALIZAR sus propios avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Política: permitir a usuarios autenticados ELIMINAR sus propios avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Política: permitir a TODOS ver avatars (bucket público)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 6. Verificar que el bucket fue creado
SELECT * FROM storage.buckets WHERE id = 'avatars';

-- 7. Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';

-- ============================================
-- LISTO ✅
-- Bucket 'avatars' creado con políticas RLS
-- ============================================
