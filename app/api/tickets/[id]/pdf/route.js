// app/api/tickets/[id]/pdf/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(req, { params }) {
  try {
    const supabase = getSupabaseAdmin();
    const ticketId = params?.id;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: uData, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !uData?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const user = uData.user;

    // 1) Traer ticket
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, ticket_upload_id, storage_bucket, storage_path")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // 2) Verificar que sea comprador o vendedor de alguna orden con este ticket
    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status, renominated_storage_bucket, renominated_storage_path")
      .eq("ticket_id", ticket.id)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const isBuyer = order.buyer_id === user.id;

    // 3) Saber si es nominada (desde ticket_uploads)
    let isNominada = false;
    if (ticket.ticket_upload_id) {
      const { data: tu } = await supabase
        .from("ticket_uploads")
        .select("is_nominada")
        .eq("id", ticket.ticket_upload_id)
        .maybeSingle();
      isNominada = !!tu?.is_nominada;
    }

    // 4) Si es nominada y comprador intenta descargar pero NO existe renominado => bloquear
    if (isNominada && isBuyer && !order.renominated_storage_path) {
      return NextResponse.json(
        { error: "RENOMINATION_PENDING", message: "Ticket nominada: falta subir el PDF renominado." },
        { status: 409 }
      );
    }

    // 5) Elegir qué archivo entregar
    let bucket = ticket.storage_bucket || "tickets";
    let path = ticket.storage_path || null;

    // Si hay renominado, usarlo (para buyer y seller)
    if (order.renominated_storage_path) {
      bucket = order.renominated_storage_bucket || "tickets";
      path = order.renominated_storage_path;
    }

    // Fallback: si ticket no tiene storage_path, intentar desde ticket_upload
    if (!path && ticket.ticket_upload_id) {
      const { data: tu2 } = await supabase
        .from("ticket_uploads")
        .select("storage_bucket, storage_path")
        .eq("id", ticket.ticket_upload_id)
        .maybeSingle();
      bucket = tu2?.storage_bucket || bucket;
      path = tu2?.storage_path || path;
    }

    if (!path) {
      return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
    }

    // 6) Signed URL
    const { data: signed, error: sErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 min

    if (sErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "SIGNED_URL_ERROR", details: sErr?.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: signed.signedUrl, isNominada, deliveredRenominated: !!order.renominated_storage_path });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
