// app/support/create/route.js
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

function addHours(date, h) {
  const d = new Date(date);
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

export async function POST(req) {
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
    const user = u.user;

    const body = await req.json().catch(() => ({}));
    const category = String(body?.category || "soporte").trim();
    const subject = String(body?.subject || "").trim();
    const text = String(body?.body || "").trim();

    if (!subject) return json({ error: "Missing subject" }, 400);
    if (!text) return json({ error: "Missing body" }, 400);

    // Perfil (para requester_name / rut)
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name, rut, email")
      .eq("id", user.id)
      .maybeSingle();

    // ticket_number “next”
    const { data: maxRow } = await supabaseAdmin
      .from("support_tickets")
      .select("ticket_number")
      .order("ticket_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = Number(maxRow?.ticket_number || 1000) + 1;

    const now = new Date().toISOString();
    const due_at =
      category === "disputa_compra" || category === "disputa_venta"
        ? addHours(now, 48)
        : addHours(now, 72);

    // Insert ticket
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: user.id,
        ticket_number: nextNumber,
        status: "submitted",
        category,
        subject,
        requester_email: prof?.email || user.email || null,
        requester_name: prof?.full_name || null,
        requester_rut: prof?.rut || null,
        due_at,
        last_message_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (tErr || !ticket) {
      return json({ error: "DB insert failed", details: tErr?.message }, 500);
    }

    // Insert mensaje inicial
    const { error: mErr } = await supabaseAdmin
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_role: "user",
        sender_user_id: user.id,
        body: text,
      });

    if (mErr) {
      return json({ error: "DB insert failed", details: mErr?.message }, 500);
    }

    return json({ ok: true, ticket }, 200);
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
