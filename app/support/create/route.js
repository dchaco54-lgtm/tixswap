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
    const messageText = String(body?.message ?? body?.body ?? body?.text ?? "").trim();
    const attachment_ids = Array.isArray(body?.attachment_ids) ? body.attachment_ids : [];

    if (!category) return json({ error: "Falta categoría" }, 400);
    if (!subject) return json({ error: "Falta asunto" }, 400);
    if (!messageText) return json({ error: "Mensaje requerido" }, 400);

    const now = new Date().toISOString();

    let insertPayload = {
      user_id: user.id,
      status: "open",
      category,
      subject,
      created_at: now,
      updated_at: now,
      last_message_at: now,
      last_message_preview: messageText,
    };
    // Compatibilidad: si existe columna message en support_tickets
    insertPayload.message = messageText;

    let ticket = null;
    let tErr = null;
    for (let i = 0; i < 6; i += 1) {
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
    const { data: msg, error: mErr } = await supabaseAdmin
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_role: "user",
        sender_user_id: user.id,
        body: messageText,
        created_at: now,
      })
      .select("id")
      .single();

    if (mErr) {
      const { error: delErr } = await supabaseAdmin
        .from("support_tickets")
        .delete()
        .eq("id", ticket.id);
      if (delErr) {
        console.error("[support/create] delete ticket failed:", delErr);
      }
      return json({ error: "DB insert failed", details: mErr?.message }, 500);
    }

    if (attachment_ids.length) {
      const { error: aErr } = await supabaseAdmin
        .from("support_attachments")
        .update({ message_id: msg?.id || null, ticket_id: ticket.id })
        .in("id", attachment_ids)
        .eq("ticket_id", ticket.id);

      if (aErr) {
        return json({ error: "No se pudieron asociar adjuntos", details: aErr.message }, 500);
      }
    }

    let updatePayload = { last_message_at: now, last_message_preview: messageText };
    for (let i = 0; i < 6; i += 1) {
      const { error: lmErr } = await supabaseAdmin
        .from("support_tickets")
        .update(updatePayload)
        .eq("id", ticket.id);

      if (!lmErr) break;
      const missing = getMissingColumn(lmErr);
      if (!missing || !(missing in updatePayload)) break;
      const nextPayload = { ...updatePayload };
      delete nextPayload[missing];
      updatePayload = nextPayload;
    }

    return json(
      { ticket_id: ticket.id, message_id: msg?.id || null, ticket_number: ticket.ticket_number || null },
      200
    );
  } catch (e) {
    return json(
      { error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
