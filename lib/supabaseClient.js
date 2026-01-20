/**
 * DEPRECATED: Este archivo existe solo para compatibilidad con código antiguo.
 * 
 * MIGRACIÓN:
 * - En Client Components: import { createClient } from '@/lib/supabase/client'
 * - En Server Components: import { createServerClient } from '@/lib/supabase/server'
 * - En Route Handlers: import { createClient } from '@/lib/supabase/server'
 * 
 * Este wrapper usa el nuevo cliente con cookies para mantener compatibilidad.
 */

import { createClient } from '@/lib/supabase/client';

// Crear instancia única del cliente para compatibilidad
const supabase = createClient();

export { supabase };
export default supabase;
