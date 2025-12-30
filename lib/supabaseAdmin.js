import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || // ✅ tu nombre en Vercel
    process.env.SUPABASE_SERVICE_ROLE_KEY;    // fallback por si el código viejo usa otro

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan env vars: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

