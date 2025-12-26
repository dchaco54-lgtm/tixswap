// app/support/admin/tickets/route.js
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

    // auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const { data: u } = await supabaseAdmin.auth.getUser(token);
    if (!u?.user) return json({ error: "UNAUTHORIZED" }, 401);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();

    if (prof?.role !== "admin") return json({ error: "FORBIDDEN" }, 403);

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "all").trim();

    let query = supabaseAdmin
      .from("support_tickets")
      .select(
        "id, ticket_number, category, subject, status, created_at, last_message_at, due_at, requester_email, requester_rut",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (status !== "all") query = query.eq("status", status);

    if (q) {
      // si es TS-xxxx o número
      const cleaned = q.toLowerCase().startsWith("ts-") ? q.slice(3) : q;
      const asNum = Number(cleaned);
      if (Number.isFinite(asNum) && cleaned.length) {
        query = query.eq("ticket_number", asNum);
      } else {
        query = query.or(
          `subject.ilike.%${q}%,requester_email.ilike.%${q}%,requester_rut.ilike.%${q}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, tickets: data || [] });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
