// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = () => {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverUrl = process.env.SUPABASE_URL;

  // Preferimos el URL público (mismo proyecto) y dejamos fallback.
  const url = publicUrl || serverUrl;

  // Compat: aceptamos nombres antiguos para no volver a romper despliegues
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!url) {
    throw new Error(
      "Supabase URL no configurado. Usa NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL"
    );
  }

  if (!serviceKey) {
    throw new Error(
      "Service role key no configurada. Usa SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_KEY)"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export default supabaseAdmin;

