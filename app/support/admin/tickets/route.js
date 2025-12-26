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

function cleanQ(q) {
  return (q || "").toString().trim();
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

    // admin check
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();

    if (prof?.role !== "admin") return json({ error: "FORBIDDEN" }, 403);

    const url = new URL(req.url);
    const q = cleanQ(url.searchParams.get("q"));
    const status = cleanQ(url.searchParams.get("status")) || "all";

    let query = supabaseAdmin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Filtro server-side opcional (si viene q)
    // OJO: el front también filtra, esto solo ayuda en escala.
    if (q) {
      const qLower = q.toLowerCase();
      const digits = qLower.replace("ts-", "").replace(/[^0-9]/g, "");
      if (digits.length) {
        const n = Number(digits);
        if (!Number.isNaN(n)) {
          query = query.eq("ticket_number", n);
        }
      } else {
        // Si tus columnas existen, esto ayuda. Si alguna no existe, Supabase puede tirar error.
        // Si te llegara a dar error aquí, me dices y lo dejamos solo por subject.
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
