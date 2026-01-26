import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Genera signed URL del PDF de un ticket.
// Solo comprador (con orden pagada) o vendedor.
export async function GET(req, { params }) {
  try {
    const { id: ticketId } = params;

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // 1) Buscar orden que autorice acceso (buyer o seller)
    const { data: anyOrder, error: ordErr } = await admin
      .from("orders")
      .select("id, status, payment_state, buyer_id, seller_id, user_id, ticket_id")
      .eq("ticket_id", ticketId)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ordErr) {
      console.error("GET /api/tickets/[id]/pdf ordErr", ordErr);
      return NextResponse.json(
        { error: "Error validando permisos" },
        { status: 500 }
      );
    }

    if (!anyOrder) {
      return NextResponse.json(
        { error: "No tienes acceso a este ticket" },
        { status: 403 }
      );
    }

    // 2) Traer ticket (para seller_id / posibles columnas)
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) console.error("GET /api/tickets/[id]/pdf tErr", tErr);

    const sellerId = ticket?.seller_id || anyOrder?.seller_id;

    // 3) Intentar resolver PDF desde ticket_uploads
    let bucket = null;
    let path = null;

    // Caso nuevo: ticket tiene source_pdf_bucket / source_pdf_path
    if (ticket?.source_pdf_bucket && ticket?.source_pdf_path) {
      bucket = ticket.source_pdf_bucket;
      path = ticket.source_pdf_path;
    }

    // Caso nuevo: ticket tiene ticket_upload_id
    if (!path && ticket?.ticket_upload_id) {
      const { data: up, error: upErr } = await admin
        .from("ticket_uploads")
        .select("storage_bucket, storage_path")
        .eq("id", ticket.ticket_upload_id)
        .maybeSingle();

      if (upErr) console.error("GET /api/tickets/[id]/pdf upErr", upErr);
      if (up?.storage_path) {
        bucket = up.storage_bucket;
        path = up.storage_path;
      }
    }

    // Caso legacy (tu caso): no hay relación, fallback por seller_id
    if (!path && sellerId) {
      const { data: up2, error: upErr2 } = await admin
        .from("ticket_uploads")
        .select("storage_bucket, storage_path")
        .eq("seller_id", sellerId)
        .eq("status", "uploaded")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (upErr2) console.error("GET /api/tickets/[id]/pdf upErr2", upErr2);
      if (up2?.storage_path) {
        bucket = up2.storage_bucket;
        path = up2.storage_path;
      }
    }

    if (!bucket || !path) {
      return NextResponse.json(
        { error: "No se encontró el PDF del ticket" },
        { status: 404 }
      );
    }

    // 4) Signed URL
    const { data: signed, error: sErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 min

    if (sErr) {
      console.error("GET /api/tickets/[id]/pdf signedErr", sErr);
      return NextResponse.json(
        { error: "No se pudo generar el link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    console.error("GET /api/tickets/[id]/pdf fatal", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

