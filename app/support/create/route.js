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

function getMissingColumn(err) {
  if (!err) return null;
  const msg = `${err.message || ""} ${err.details || ""}`.trim();
  const match = msg.match(/column \"([^\"]+)\"/i);
  if (!match) return null;
  if (err.code === "42703" || msg.includes("does not exist")) return match[1];
  return null;
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
    const text = String(body?.body ?? body?.text ?? "").trim();

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

    let insertPayload = {
      user_id: user.id,
      ticket_number: nextNumber,
      status: "submitted",
      category,
      subject,
      message: text,
      requester_email: prof?.email || user.email || null,
      requester_name: prof?.full_name || null,
      requester_rut: prof?.rut || null,
      due_at,
      last_message_at: now,
      updated_at: now,
    };

    let ticket = null;
    let tErr = null;
    for (let i = 0; i < 3; i += 1) {
      const res = await supabaseAdmin
        .from("support_tickets")
        .insert(insertPayload)
        .select("*")
        .single();

      ticket = res.data;
      tErr = res.error;

      if (!tErr) break;

      const missing = getMissingColumn(tErr);
      if (!missing || !(missing in insertPayload)) break;
      const nextPayload = { ...insertPayload };
      delete nextPayload[missing];
      insertPayload = nextPayload;
    }

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

    const { error: lmErr } = await supabaseAdmin
      .from("support_tickets")
      .update({ last_message_at: now })
      .eq("id", ticket.id);

    if (lmErr && !getMissingColumn(lmErr)) {
      console.warn("[support/create] last_message_at update failed:", lmErr);
    }

    return json(
      { ok: true, ticketId: ticket.id, ticket_number: ticket.ticket_number || nextNumber },
      200
    );
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
