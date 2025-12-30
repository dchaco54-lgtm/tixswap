import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  // ✅ soporta ambos nombres (por si cambiaste uno u otro)
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan env vars: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
