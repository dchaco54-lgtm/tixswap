// app/support/admin/tickets/route.js
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
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "all").trim();

    let query = supabaseAdmin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status !== "all") query = query.eq("status", status);

    if (q) {
      const qLower = q.toLowerCase();
      const digits = qLower.replace("ts-", "").replace(/[^0-9]/g, "");

      if (digits.length) {
        const n = Number(digits);
        if (!Number.isNaN(n)) query = query.eq("ticket_number", n);
      } else {
        // Ajustado a tus campos típicos
        query = query.or(
          `subject.ilike.%${q}%,requester_email.ilike.%${q}%,requester_rut.ilike.%${q}%`
        );
      }
    }

    const { data: tickets, error } = await query;
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, tickets: tickets || [] });
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
