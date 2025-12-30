import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (Service Role)
 * - Usa SUPABASE_URL si existe, si no usa NEXT_PUBLIC_SUPABASE_URL
 * - Usa SUPABASE_SERVICE_ROLE_KEY (Service Role)
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan env vars: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y/o SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
