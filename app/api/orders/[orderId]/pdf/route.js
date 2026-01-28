// app/api/orders/[orderId]/pdf/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function toDateSafe(v) {
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// Heurística MVP para tickets antiguos SIN link: el upload más cercano antes del ticket.created_at
function pickBestUpload({ uploads, ticketCreatedAt }) {
  if (!Array.isArray(uploads) || uploads.length === 0) return null;

  const tCreated = toDateSafe(ticketCreatedAt);

  if (tCreated) {
    const before = uploads
      .map((u) => ({ u, d: toDateSafe(u.created_at) }))
      .filter(({ d }) => d && d.getTime() <= tCreated.getTime())
      .sort((a, b) => b.d.getTime() - a.d.getTime());
    if (before.length > 0) return before[0].u;
  }

  // fallback: el más nuevo
  return uploads
    .map((u) => ({ u, d: toDateSafe(u.created_at) }))
    .sort((a, b) => (b.d?.getTime?.() || 0) - (a.d?.getTime?.() || 0))[0]?.u;
}

async function resolvePdfForTicket(admin, ticketId) {
  // Ticket completo (select * para evitar errores por columnas inexistentes)
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (tErr || !ticket) return { error: tErr?.message || "Ticket no encontrado" };

  // 1) Si el ticket ya tuviera paths guardados (schemas distintos)
  const directPath =
    ticket.storage_path || ticket.pdf_path || ticket.ticket_pdf_path || null;
  const directBucket =
    ticket.storage_bucket || ticket.pdf_bucket || "ticket-pdfs";

  if (directPath) {
    return { bucket: directBucket, path: directPath, ticket };
  }

  // 2) Si existiera ticket_upload_id (ideal)
  const uploadId = ticket.ticket_upload_id || ticket.ticket_uploads_id || null;
  if (uploadId) {
    const { data: upload } = await admin
      .from("ticket_uploads")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();

    if (upload) {
      const path = upload.storage_path || upload.file_path || upload.path;
      const bucket = upload.storage_bucket || upload.bucket || "ticket-pdfs";
      if (path) return { bucket, path, ticket, upload };
    }
  }

  // 3) Fallback MVP: buscar upload por seller_id y tiempo
  if (ticket.seller_id) {
    const { data: uploads } = await admin
      .from("ticket_uploads")
      .select("*")
      .eq("seller_id", ticket.seller_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const picked = pickBestUpload({
      uploads,
      ticketCreatedAt: ticket.created_at,
    });

    const path = picked?.storage_path || picked?.file_path || picked?.path;
    const bucket = picked?.storage_bucket || picked?.bucket || "ticket-pdfs";
    if (path) return { bucket, path, ticket, upload: picked };
  }

  return {
    error:
      "No encontré el PDF asociado. (Recomendación: guardar ticket_upload_id al publicar).",
  };
}

export async function GET(req, { params }) {
  try {
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Falta orderId" }, { status: 400 });
    }

    // Auth via cookies
    const supabase = createClient(cookies());
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // Buscar order (admin bypass RLS)
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select(
        "id, buyer_id, seller_id, ticket_id, status, payment_state, renominated_storage_bucket, renominated_storage_path"
      )
      .eq("id", orderId)
      .single();

    if (oErr || !order) {
      return NextResponse.json(
        { error: oErr?.message || "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Solo buyer o seller
    if (user.id !== order.buyer_id && user.id !== order.seller_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Para el MVP: debe ser paid o AUTHORIZED
    const paidOk =
      String(order.status || "").toLowerCase() === "paid" ||
      String(order.payment_state || "").toUpperCase() === "AUTHORIZED";

    if (!paidOk) {
      return NextResponse.json(
        { error: "La orden aún no está pagada." },
        { status: 400 }
      );
    }

    // 0) Si existe PDF re-nominado, el comprador debe descargar ese.
    if (order.renominated_storage_path) {
      const bucket = order.renominated_storage_bucket || "ticket-pdfs";
      const path = order.renominated_storage_path;

      const { data: signed, error: sErr } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 10);

      if (sErr || !signed?.signedUrl) {
        return NextResponse.json(
          { error: sErr?.message || "No se pudo firmar el PDF" },
          { status: 500 }
        );
      }

      const res = NextResponse.redirect(signed.signedUrl, 302);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const resolved = await resolvePdfForTicket(admin, order.ticket_id);
    if (resolved?.error) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const { bucket, path } = resolved;

    const { data: signed, error: sErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10);

    if (sErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: sErr?.message || "No se pudo firmar el PDF" },
        { status: 500 }
      );
    }

    const res = NextResponse.redirect(signed.signedUrl, 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: "Error interno", details: String(e) },
      { status: 500 }
    );
  }
}
