// app/support/admin/update/route.js
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function env(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

export async function POST(req) {
  try {
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Missing env" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const { data: u } = await supabaseAdmin.auth.getUser(token);
    if (!u?.user) return json({ error: "UNAUTHORIZED" }, 401);

    // Validar admin usando app_role (con fallback a user_type)
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("app_role, user_type, email")
      .eq("id", u.user.id)
      .maybeSingle();

    if (profErr) {
      console.error("Error loading profile:", profErr);
      return json({ error: "FORBIDDEN" }, 403);
    }

    // Verificar permisos: app_role='admin' OR user_type='admin' OR email específico
    const isAdmin = 
      prof?.app_role === 'admin' || 
      prof?.user_type === 'admin' ||
      prof?.email?.toLowerCase() === 'davidchacon_17@hotmail.com';

    if (!isAdmin) {
      return json({ error: "FORBIDDEN - Not admin" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const ticket_id = body?.ticket_id;
    const status = body?.status;

    if (!ticket_id) return json({ error: "Falta ticket_id" }, 400);
    if (!status) return json({ error: "Falta status" }, 400);

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id, status")
      .eq("id", ticket_id)
      .single();

    if (exErr || !existing) return json({ error: "Ticket no existe" }, 404);

    const payload = {
      status,
      updated_at: new Date().toISOString(),
    };

    const isClosing = (status === "resolved" || status === "rejected") &&
      existing.status !== "resolved" &&
      existing.status !== "rejected";

    if (isClosing) {
      payload.closed_at = new Date().toISOString();
      payload.closed_by = u.user.id;
    }

    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update(payload)
      .eq("id", ticket_id);

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
