// app/support/admin/update/route.js
import { getSupabaseAdmin, getUserFromBearer, isAdminUser } from "@/lib/support/auth";
import { isTerminalStatus, normalizeStatus, TICKET_STATUS } from "@/lib/support/status";

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
    const rawClosedReason = body?.closed_reason;

    if (!ticket_id) return json({ error: "Falta ticket_id" }, 400);
    if (!rawStatus) return json({ error: "Falta status" }, 400);

    const status = normalizeStatus(rawStatus);

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id, status, reopen_count")
      .eq("id", ticket_id)
      .single();

    if (exErr || !existing) return json({ error: "Ticket no existe" }, 404);

    const currentStatus = normalizeStatus(existing.status);
    const reopenCount = Number(existing?.reopen_count || 0);

    if (currentStatus === TICKET_STATUS.CLOSED && status !== TICKET_STATUS.CLOSED) {
      return json({ error: "Ticket cerrado no se puede reabrir" }, 403);
    }

    let nextStatus = status;
    let closedReason = rawClosedReason ? String(rawClosedReason).trim() : null;

    if (status === TICKET_STATUS.RESOLVED && reopenCount >= 1) {
      nextStatus = TICKET_STATUS.CLOSED;
      closedReason = "resolved_final";
    }

    const isReopening =
      currentStatus === TICKET_STATUS.RESOLVED &&
      !isTerminalStatus(nextStatus) &&
      nextStatus !== TICKET_STATUS.RESOLVED;

    if (isReopening && reopenCount >= 1) {
      return json({ error: "Este ticket ya fue reabierto una vez" }, 403);
    }

    const payload = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    const isClosing = nextStatus === TICKET_STATUS.CLOSED && currentStatus !== TICKET_STATUS.CLOSED;

    if (isClosing) {
      payload.closed_at = new Date().toISOString();
      payload.closed_by = user.id;
      payload.closed_reason = closedReason || null;
    }

    if (isReopening) {
      payload.closed_at = null;
      payload.closed_by = null;
      payload.closed_reason = null;
      payload.reopen_count = reopenCount + 1;
    }

    if (nextStatus === TICKET_STATUS.RESOLVED) {
      payload.resolved_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update(payload)
      .eq("id", ticket_id);

    if (error) return json({ error: error.message }, 500);

    if (currentStatus !== nextStatus) {
      try {
        await supabaseAdmin.from("support_ticket_status_logs").insert({
          ticket_id,
          from_status: currentStatus,
          to_status: nextStatus,
          changed_by: user.id,
        });
      } catch (logErr) {
        console.warn("[support/admin/update] status log skipped", logErr?.message || logErr);
      }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
