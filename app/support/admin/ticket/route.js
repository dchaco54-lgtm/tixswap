// app/support/admin/ticket/route.js
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

export async function GET(req) {
  try {
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Missing env" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Bearer token
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

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Missing id" }, 400);

    // Ticket
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .single();

    if (tErr || !ticket) return json({ error: "Ticket not found" }, 404);

    // Mensajes
    const { data: msgs } = await supabaseAdmin
      .from("support_messages")
      .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    // Adjuntos
    const { data: atts } = await supabaseAdmin
      .from("support_attachments")
      .select("id, ticket_id, message_id, storage_path, filename, mime_type, size_bytes, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    const attachments = [];
    for (const a of atts || []) {
      if (!a.storage_path) {
        attachments.push({
          ...a,
          signed_url: null,
          file_name: a.filename,
          file_size: a.size_bytes,
        });
        continue;
      }

      const { data: signed } = await supabaseAdmin.storage
        .from("support-attachments")
        .createSignedUrl(a.storage_path, 60 * 30);

      attachments.push({
        ...a,
        signed_url: signed?.signedUrl || null,
        file_name: a.filename,
        file_size: a.size_bytes,
      });
    }

    return json({
      ok: true,
      ticket,
      messages: (msgs || []).map((m) => ({
        ...m,
        body: m.body ?? m.message,
        sender_type: m.sender_role,
        sender_id: m.sender_user_id,
      })),
      attachments,
    });
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
