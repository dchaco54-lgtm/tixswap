// app/support/admin/ticket/route.js
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
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Missing id" }, 400);

    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .single();

    if (tErr || !ticket) return json({ error: "Ticket not found" }, 404);

    const { data: msgs } = await supabaseAdmin
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    const { data: atts } = await supabaseAdmin
      .from("support_ticket_attachments")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    // signed urls
    const attachments = [];
    for (const a of atts || []) {
      const { data: signed } = await supabaseAdmin.storage
        .from(a.bucket)
        .createSignedUrl(a.path, 60 * 30);

      attachments.push({
        ...a,
        signed_url: signed?.signedUrl || null,
      });
    }

    return json({
      ok: true,
      ticket,
      messages: msgs || [],
      attachments,
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}

