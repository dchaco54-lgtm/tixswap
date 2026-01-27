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

/** @type {import("@supabase/supabase-js").SupabaseClient | undefined} */
let supabase;
/** @returns {import("@supabase/supabase-js").SupabaseClient} */
const getSupabase = () => {
  if (!supabase) supabase = createClient();
  return supabase;
};

/** @type {import("@supabase/supabase-js").SupabaseClient} */
const supabaseProxy = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabase();
    return client[prop];
  },
});

export { supabaseProxy as supabase };
export default supabaseProxy;
