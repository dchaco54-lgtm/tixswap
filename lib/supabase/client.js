/**
 * Cliente Supabase para Client Components
 * Usa cookies para auth (consistente con middleware)
 * 
 * USO:
 * import { createClient } from '@/lib/supabase/client'
 * const supabase = createClient()
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const createClient = () => createClientComponentClient();
