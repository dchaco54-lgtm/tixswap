// app/support/upload/route.js
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

function extFromName(name = "") {
  const i = name.lastIndexOf(".");
  if (i === -1) return "";
  return name.slice(i).toLowerCase();
}

function allowMime(mime) {
  if (!mime) return false;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("image/")) return true;
  if (mime.startsWith("audio/")) return true;
  return false;
}

export async function POST(req) {
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

    const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "UNAUTHORIZED" }, 401);
    const user = u.user;

    const form = await req.formData();
    const ticketId = String(form.get("ticketId") || "").trim();
    const file = form.get("file");

    if (!ticketId) return json({ error: "Missing ticketId" }, 400);
    if (!file || !(file instanceof File)) return json({ error: "Missing file" }, 400);

    // es admin?
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = prof?.role === "admin";

    // validar ticket & permisos
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, status")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) return json({ error: "Ticket no existe" }, 404);
    if (!isAdmin && ticket.user_id !== user.id) return json({ error: "FORBIDDEN" }, 403);

    // no permitir adjuntar si está cerrado
    if (ticket.status === "resolved" || ticket.status === "rejected") {
      return json({ error: "Este ticket está cerrado" }, 403);
    }

    if (!allowMime(file.type)) {
      return json({ error: "Tipo de archivo no permitido (solo PDF/imagen/audio)" }, 400);
    }

    const maxBytes = 12 * 1024 * 1024; // 12MB
    if (file.size > maxBytes) return json({ error: "Archivo supera 12MB" }, 400);

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
    const ext = extFromName(file.name) || (file.type === "application/pdf" ? ".pdf" : "");

    const bucket = "support-attachments";
    const path = `tickets/${ticketId}/${Date.now()}_${sha}${ext}`;

    const { error: upErr } = await supabaseAdmin.storage.from(bucket).upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (upErr) return json({ error: "Storage upload failed", details: upErr.message }, 500);

    const { data: row, error: insErr } = await supabaseAdmin
      .from("support_attachments")
      .insert({
        ticket_id: ticketId,
        storage_path: path,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("id, ticket_id, message_id, storage_path, filename, mime_type, size_bytes, created_at")
      .single();

    if (insErr) {
      await supabaseAdmin.storage.from(bucket).remove([path]);
      return json({ error: "DB insert failed", details: insErr.message }, 500);
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 30);

    return json({
      ok: true,
      attachment: row
        ? {
            ...row,
            signed_url: signed?.signedUrl || null,
            file_name: row.filename,
            file_size: row.size_bytes,
          }
        : null,
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
