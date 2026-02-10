// app/support/my/tickets/route.js
// Lista de tickets del usuario autenticado

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

    // auth user
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const { data: u } = await supabaseAdmin.auth.getUser(token);
    if (!u?.user) return json({ error: "UNAUTHORIZED" }, 401);

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "all").trim();

    let query = supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (status && status !== "all") query = query.eq("status", status);

    const { data: tickets, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const list = Array.isArray(tickets) ? tickets : [];
    const ids = list.map((t) => t.id).filter(Boolean);
    let lastByTicket = {};

    if (ids.length) {
      const { data: msgs } = await supabaseAdmin
        .from("support_messages")
        .select("ticket_id, body, created_at")
        .in("ticket_id", ids)
        .order("created_at", { ascending: false });

      for (const m of msgs || []) {
        if (!lastByTicket[m.ticket_id]) lastByTicket[m.ticket_id] = m;
      }
    }

    const normalized = list.map((t) => {
      const last = lastByTicket[t.id];
      const lastAt = t.last_message_at || last?.created_at || t.created_at || null;
      const preview = t.last_message_preview || last?.body || last?.message || "";
      return {
        ...t,
        last_message_at: lastAt,
        last_message_preview: preview,
      };
    });

    normalized.sort((a, b) => {
      const da = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const db = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return db - da;
    });

    return json({ ok: true, tickets: normalized });
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
