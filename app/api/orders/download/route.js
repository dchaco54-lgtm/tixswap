import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function columnExists(admin, table, column) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", table)
    .eq("column_name", column)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const admin = supabaseAdmin();

  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Falta orderId." }, { status: 400 });
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, status, buyer_id, ticket_id")
      .eq("id", orderId)
      .single();

    if (oErr || !order) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    if (order.status !== "held") {
      return NextResponse.json(
        { error: "El PDF se libera sólo cuando el pago está aprobado." },
        { status: 400 }
      );
    }

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, ticket_upload_id, ticket_pdf_path")
      .eq("id", order.ticket_id)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
    }

    let bucket = "ticket-pdfs";
    let path = ticket.ticket_pdf_path;

    // Si existe ticket_upload_id, preferimos resolver por ticket_uploads
    if (ticket.ticket_upload_id) {
      const { data: up } = await admin
        .from("ticket_uploads")
        .select("storage_bucket, storage_path")
        .eq("id", ticket.ticket_upload_id)
        .maybeSingle();

      if (up?.storage_bucket && up?.storage_path) {
        bucket = up.storage_bucket;
        path = up.storage_path;
      }
    }

    if (!path) {
      return NextResponse.json(
        { error: "No hay PDF asociado al ticket." },
        { status: 400 }
      );
    }

    const { data: signed, error: sErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 5);

    if (sErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "No se pudo generar link de descarga." }, { status: 500 });
    }

    // Incrementar contador si existe
    if (await columnExists(admin, "orders", "download_count")) {
      const { data: current } = await admin
        .from("orders")
        .select("download_count")
        .eq("id", orderId)
        .maybeSingle();

      const next = Number(current?.download_count || 0) + 1;

      const upd = { download_count: next };
      if (await columnExists(admin, "orders", "last_downloaded_at")) {
        upd.last_downloaded_at = new Date().toISOString();
      }

      await admin.from("orders").update(upd).eq("id", orderId);
    }

    return NextResponse.json({
      ok: true,
      downloadUrl: signed.signedUrl,
      expiresIn: 300,
    });
  } catch (e) {
    console.error("orders/download error:", e);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
