// app/support/admin/update/route.js
import { getSupabaseAdmin, getUserFromBearer, isAdminUser } from "@/lib/support/auth";
import { isTerminalStatus, normalizeStatus } from "@/lib/support/status";

export const runtime = "nodejs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { user, error: authErr } = await getUserFromBearer(req, supabaseAdmin);
    if (authErr || !user) return json({ error: "UNAUTHORIZED" }, 401);

    const { ok: isAdmin } = await isAdminUser(supabaseAdmin, user);
    if (!isAdmin) return json({ error: "FORBIDDEN - Not admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const ticket_id = body?.ticket_id;
    const rawStatus = body?.status;

    if (!ticket_id) return json({ error: "Falta ticket_id" }, 400);
    if (!rawStatus) return json({ error: "Falta status" }, 400);

    const status = normalizeStatus(rawStatus);

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

    const wasTerminal = isTerminalStatus(normalizeStatus(existing.status));
    const isClosing = isTerminalStatus(status) && !wasTerminal;
    const isReopening = !isTerminalStatus(status) && wasTerminal;

    if (isClosing) {
      payload.closed_at = new Date().toISOString();
      payload.closed_by = user.id;
    }

    if (isReopening) {
      payload.closed_at = null;
      payload.closed_by = null;
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
