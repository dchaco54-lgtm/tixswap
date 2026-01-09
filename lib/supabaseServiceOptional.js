import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client using the Service Role key **if** it looks correctly
 * configured, otherwise returns null.
 *
 * This is helpful for server-side read queries where you prefer bypassing RLS
 * (service role), but still want the app to work if the key isn't available or
 * is accidentally set to the anon key.
 */
export function supabaseServiceOptional() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  // Common misconfig: service role key accidentally set to anon key
  if (anonKey && serviceKey.trim() === anonKey.trim()) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
