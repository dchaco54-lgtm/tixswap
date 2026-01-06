import { createClient } from "@supabase/supabase-js";

// Server-only Supabase admin client (Service Role).
//
// Este repo tiene 2 estilos en uso:
//   - const admin = supabaseAdmin(); admin.from(...)
//   - supabaseAdmin.from(...)
//
// Para no romper nada, exportamos `supabaseAdmin` como un Proxy sobre una función.
// Llamarlo devuelve el client, y acceder a propiedades reenvía al client real.

let _client = null;

function buildClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) env var for server admin client."
    );
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var for server admin client.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getClient() {
  if (!_client) _client = buildClient();
  return _client;
}

const handler = {
  get(_target, prop) {
    const c = getClient();
    const value = c[prop];
    // Si es función (ej: from), la bindeamos al client
    if (typeof value === "function") return value.bind(c);
    return value;
  },
  apply() {
    // Permite supabaseAdmin() => client
    return getClient();
  },
};

export const supabaseAdmin = new Proxy(function () {}, handler);
export default supabaseAdmin;
