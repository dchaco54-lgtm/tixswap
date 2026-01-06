import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  // ✅ Server-side must use the Service Role key (never the anon public key)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase URL or Service Role Key");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
