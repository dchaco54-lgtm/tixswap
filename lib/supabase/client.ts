/**
 * Cliente Supabase para Client Components
 * Usa cookies para auth (consistente con middleware)
 * 
 * USO:
 * import { createClient } from '@/lib/supabase/client'
 * const supabase = createClient()
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [];

  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length) {
    throw new Error(`Missing Supabase env vars: ${missing.join(", ")}`);
  }

  return createClientComponentClient();
};
