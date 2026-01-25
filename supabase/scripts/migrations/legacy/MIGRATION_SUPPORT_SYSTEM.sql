-- ============================================
-- MIGRACIÓN: Sistema de Soporte TixSwap v2
-- ============================================
-- Este archivo unifica permisos, normaliza estados y prepara el sistema
-- de soporte para funcionar como SaaS/Fintech.
--
-- EJECUTAR EN: Supabase SQL Editor
-- FECHA: 2026-01-21
-- ============================================

-- ============================================
-- PARTE 1: AGREGAR COLUMNA app_role PARA PERMISOS
-- ============================================
-- Separar permisos de admin (app_role) de tier de usuario (tier)
-- y tipo de cuenta (user_type: standard/free).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'app_role'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN app_role text DEFAULT 'user' CHECK (app_role IN ('user', 'admin'));
    
    RAISE NOTICE 'Columna app_role agregada exitosamente';
  ELSE
    RAISE NOTICE 'Columna app_role ya existe, saltando...';
  END IF;
END $$;

-- ============================================
-- PARTE 2: SETEAR ADMINS EXISTENTES
-- ============================================
-- Configurar usuarios con permisos de administrador.

-- Admin principal (davidchacon_17@hotmail.com)
UPDATE public.profiles
SET app_role = 'admin'
WHERE email = 'davidchacon_17@hotmail.com';

-- Soporte TixSwap (si existe)
UPDATE public.profiles
SET app_role = 'admin'
WHERE email = 'soporte@tixswap.cl';

-- Si hay usuarios con user_type='admin', también setearlos
UPDATE public.profiles
SET app_role = 'admin'
WHERE user_type = 'admin' AND app_role != 'admin';

-- VERIFICAR: Mostrar admins configurados
SELECT 
  id,
  email,
  full_name,
  app_role,
  user_type
FROM public.profiles
WHERE app_role = 'admin';

-- ============================================
-- PARTE 3: NORMALIZAR ESTADOS DE TICKETS
-- ============================================
-- Convertir estados legacy a estados nuevos estandarizados.
-- Estados nuevos: 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'

-- Convertir 'abierto' -> 'open'
UPDATE public.support_tickets
SET status = 'open'
WHERE status = 'abierto' OR status = 'Abierto' OR status = 'ABIERTO';

-- Convertir 'en_revision' / 'in_review' -> 'in_progress'
UPDATE public.support_tickets
SET status = 'in_progress'
WHERE status IN ('en_revision', 'in_review', 'En revisión');

-- Convertir 'pendiente_info' / 'pending_info' -> 'waiting_user'
UPDATE public.support_tickets
SET status = 'waiting_user'
WHERE status IN ('pendiente_info', 'pending_info', 'pendiente_antecedentes');

-- Convertir 'resuelto' -> 'resolved'
UPDATE public.support_tickets
SET status = 'resolved'
WHERE status IN ('resuelto', 'Resuelto', 'finalizado');

-- Convertir 'cerrado' -> 'closed'
UPDATE public.support_tickets
SET status = 'closed'
WHERE status = 'cerrado' OR status = 'Cerrado';

-- VERIFICAR: Mostrar distribución de estados después de normalización
SELECT 
  status,
  COUNT(*) as cantidad
FROM public.support_tickets
GROUP BY status
ORDER BY cantidad DESC;

-- ============================================
-- PARTE 4: AGREGAR COLUMNAS FALTANTES (si no existen)
-- ============================================

-- Columna last_message_at (para ordenar tickets por actividad reciente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'support_tickets' 
    AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE public.support_tickets 
    ADD COLUMN last_message_at timestamptz DEFAULT now();
    
    -- Inicializar con created_at para tickets existentes
    UPDATE public.support_tickets
    SET last_message_at = created_at
    WHERE last_message_at IS NULL;
    
    RAISE NOTICE 'Columna last_message_at agregada';
  ELSE
    RAISE NOTICE 'Columna last_message_at ya existe';
  END IF;
END $$;

-- Columna code (identificador amigable TS-0001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'support_tickets' 
    AND column_name = 'code'
  ) THEN
    ALTER TABLE public.support_tickets 
    ADD COLUMN code text UNIQUE;
    
    -- Generar códigos para tickets existentes
    UPDATE public.support_tickets
    SET code = 'TS-' || LPAD(id::text, 4, '0')
    WHERE code IS NULL;
    
    RAISE NOTICE 'Columna code agregada y poblada';
  ELSE
    RAISE NOTICE 'Columna code ya existe';
  END IF;
END $$;

-- ============================================
-- PARTE 5: CREAR TRIGGER PARA ACTUALIZAR last_message_at
-- ============================================
-- Cada vez que se inserta un mensaje, actualizar last_message_at del ticket

CREATE OR REPLACE FUNCTION update_ticket_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_tickets
  SET last_message_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si ya existe
DROP TRIGGER IF EXISTS trigger_update_ticket_last_message ON public.support_messages;

-- Crear trigger
CREATE TRIGGER trigger_update_ticket_last_message
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION update_ticket_last_message();

-- ============================================
-- PARTE 6: POLÍTICAS RLS (Row Level Security)
-- ============================================
-- Asegurar que usuarios solo vean sus tickets y admins vean todos

-- Habilitar RLS en support_tickets si no está habilitado
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios ven solo sus tickets
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.app_role = 'admin'
  )
);

-- Política: Usuarios pueden crear tickets
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
CREATE POLICY "Users can create tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Solo admins pueden actualizar tickets
DROP POLICY IF EXISTS "Admins can update tickets" ON public.support_tickets;
CREATE POLICY "Admins can update tickets"
ON public.support_tickets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.app_role = 'admin'
  )
);

-- Políticas para support_messages
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.support_messages;
CREATE POLICY "Users can view messages for their tickets"
ON public.support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
    AND (
      support_tickets.user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.app_role = 'admin'
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can insert messages to their tickets" ON public.support_messages;
CREATE POLICY "Users can insert messages to their tickets"
ON public.support_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
    AND (
      support_tickets.user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.app_role = 'admin'
      )
    )
  )
);

-- ============================================
-- PARTE 7: ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índice para buscar tickets por usuario
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id 
ON public.support_tickets(user_id);

-- Índice para ordenar por última actividad
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_message_at 
ON public.support_tickets(last_message_at DESC);

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
ON public.support_tickets(status);

-- Índice para buscar por code
CREATE INDEX IF NOT EXISTS idx_support_tickets_code 
ON public.support_tickets(code);

-- Índice para mensajes por ticket
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id 
ON public.support_messages(ticket_id, created_at);

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- 1. Verificar estructura de profiles
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('app_role', 'user_type')
ORDER BY ordinal_position;

-- 2. Verificar admins configurados
SELECT 
  email,
  full_name,
  app_role,
  user_type
FROM public.profiles
WHERE app_role = 'admin';

-- 3. Verificar estados normalizados
SELECT 
  status,
  COUNT(*) as total,
  MAX(last_message_at) as ultima_actividad
FROM public.support_tickets
GROUP BY status
ORDER BY total DESC;

-- 4. Verificar que trigger funciona
SELECT 
  proname as trigger_name,
  prosrc as trigger_code
FROM pg_proc
WHERE proname = 'update_ticket_last_message';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. app_role: Permisos del sistema ('user' o 'admin')
-- 2. user_type: Tipo de cuenta ('standard', 'free', 'premium')
-- 3. tier: Nivel de beneficios ('Basico', 'Pro', etc.)
-- 4. Estados normalizados: 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'
-- 5. Todos los tickets ahora tienen code (TS-XXXX) para mejor UX
-- 6. last_message_at se actualiza automáticamente via trigger
-- 7. RLS configurado para seguridad: users ven sus tickets, admins ven todos
-- ============================================
