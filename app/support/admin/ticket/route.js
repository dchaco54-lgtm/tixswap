// app/support/admin/ticket/route.js
import { getSupabaseAdmin, getUserFromBearer, isAdminUser } from "@/lib/support/auth";

export const runtime = "nodejs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { user, error: authErr } = await getUserFromBearer(req, supabaseAdmin);
    if (authErr || !user) return json({ error: "UNAUTHORIZED" }, 401);

    const { ok: isAdmin } = await isAdminUser(supabaseAdmin, user);
    if (!isAdmin) return json({ error: "FORBIDDEN - Not admin" }, 403);

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

    const byMessageId = {};
    for (const a of attachments) {
      if (!a?.message_id) continue;
      if (!byMessageId[a.message_id]) byMessageId[a.message_id] = [];
      byMessageId[a.message_id].push(a);
    }

    const loose = attachments.filter((a) => !a?.message_id);

    return json({
      ok: true,
      ticket,
      messages: (msgs || []).map((m) => ({
        ...m,
        body: m.body ?? m.message,
        sender_type: m.sender_role,
        sender_id: m.sender_user_id,
        attachments: byMessageId[m.id] || [],
      })),
      attachments,
      loose_attachments: loose,
    });
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
