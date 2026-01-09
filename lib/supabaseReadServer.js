import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for **read-only** public data.
 *
 * This avoids hard-depending on SUPABASE_SERVICE_ROLE_KEY for pages that only
 * need to read listings/events. It uses the ANON key, so your RLS policies
 * remain in control.
 */
export function supabaseReadServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
