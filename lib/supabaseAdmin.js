import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  // IMPORTANT:
  // Use the same Supabase project URL that the browser uses.
  // If SUPABASE_URL points to a different project than NEXT_PUBLIC_SUPABASE_URL,
  // API routes will query the wrong DB and you'll see errors like "Ticket no encontrado"
  // even when the ticket is visible in the UI.
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverUrl = process.env.SUPABASE_URL;
  const url = publicUrl || serverUrl;

  // ✅ Server-side must use the Service Role key (never the anon public key)
  if (publicUrl && serverUrl && publicUrl !== serverUrl) {
    console.warn(
      "[supabaseAdmin] SUPABASE_URL != NEXT_PUBLIC_SUPABASE_URL. Using NEXT_PUBLIC_SUPABASE_URL.",
    );
  }

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
