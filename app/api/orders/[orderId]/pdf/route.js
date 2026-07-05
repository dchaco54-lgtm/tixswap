// app/api/orders/[orderId]/pdf/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimitByRequest } from "@/lib/security/rateLimit";
import { logAuditEvent } from "@/lib/security/audit";
import {
  getTicketUploadBucket,
  getTicketUploadEffectivePath,
} from "@/lib/ticketUploads";

export const dynamic = "force-dynamic";

function normalizeValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function uniqueValues(values = []) {
  return Array.from(
    new Set(values.map(normalizeValue).filter(Boolean))
  );
}

function buildBucketCandidates(...values) {
  return uniqueValues([
    ...values,
    process.env.TICKET_PDF_BUCKET,
    "ticket-pdfs",
    "tickets",
  ]);
}

function buildPathCandidates(...values) {
  return uniqueValues(values);
}

function createCandidateRef(...entries) {
  const buckets = buildBucketCandidates(...entries.map((entry) => entry?.bucket));
  const paths = buildPathCandidates(...entries.map((entry) => entry?.path));
  if (!buckets.length || !paths.length) return null;
  return { buckets, paths };
}

function mergeCandidateRefs(...refs) {
  const buckets = uniqueValues(refs.flatMap((ref) => ref?.buckets || []));
  const paths = uniqueValues(refs.flatMap((ref) => ref?.paths || []));
  if (!buckets.length || !paths.length) return null;
  return { buckets, paths };
}

async function createSignedUrlWithFallback(admin, candidateRef, expiresIn = 60 * 10) {
  if (!candidateRef?.buckets?.length || !candidateRef?.paths?.length) {
    return { error: "FILE_NOT_FOUND" };
  }

  let lastError = null;

  for (const path of candidateRef.paths) {
    for (const bucket of candidateRef.buckets) {
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (!error && data?.signedUrl) {
        return { bucket, path, signedUrl: data.signedUrl };
      }
      lastError = error || lastError;
    }
  }

  return {
    error: lastError?.message || "SIGNED_URL_ERROR",
    details: {
      buckets: candidateRef.buckets,
      paths: candidateRef.paths,
    },
  };
}

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
    ticket.upload_path ||
    ticket.storage_path ||
    ticket.pdf_path ||
    ticket.ticket_pdf_path ||
    ticket.file_path ||
    ticket.filepath ||
    null;
  const directCandidate = createCandidateRef({
    bucket:
      ticket.upload_bucket ||
      ticket.storage_bucket ||
      ticket.pdf_bucket ||
      null,
    path: directPath,
  });

  if (directCandidate) {
    return { ticket, candidateRef: directCandidate };
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
      const uploadCandidate = createCandidateRef(
        {
          bucket: getTicketUploadBucket(upload),
          path: getTicketUploadEffectivePath(upload),
        },
        {
          bucket: upload.bucket || null,
          path: upload.path || upload.file_path || null,
        }
      );
      if (uploadCandidate) return { ticket, upload, candidateRef: uploadCandidate };
    }
  }

  // 3) Fallback MVP: buscar upload por seller_id y tiempo
  if (ticket.seller_id) {
    const { data: uploads } = await admin
      .from("ticket_uploads")
      .select("*")
      .or(`seller_id.eq.${ticket.seller_id},user_id.eq.${ticket.seller_id}`)
      .order("created_at", { ascending: false })
      .limit(10);

    const picked = pickBestUpload({
      uploads,
      ticketCreatedAt: ticket.created_at,
    });

    const pickedCandidate = createCandidateRef(
      {
        bucket: picked ? getTicketUploadBucket(picked) : null,
        path: picked ? getTicketUploadEffectivePath(picked) : null,
      },
      {
        bucket: picked?.bucket || null,
        path: picked?.path || picked?.file_path || null,
      }
    );
    if (pickedCandidate) return { ticket, upload: picked, candidateRef: pickedCandidate };
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

    const rate = rateLimitByRequest(req, {
      bucket: `order-pdf:${orderId}`,
      limit: 40,
      windowMs: 10 * 60 * 1000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Demasiadas descargas en poco tiempo." },
        { status: 429 }
      );
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

    if (user.id === order.seller_id) {
      return NextResponse.json(
        {
          error: "PDF_BLOCKED_FOR_SELLER",
          message: "El vendedor no puede descargar el PDF una vez vendida la entrada.",
        },
        { status: 403 }
      );
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
      const renominatedCandidate = createCandidateRef({
        bucket: order.renominated_storage_bucket || null,
        path: order.renominated_storage_path,
      });
      const signedRenominated = await createSignedUrlWithFallback(
        admin,
        renominatedCandidate
      );

      if (!signedRenominated?.signedUrl) {
        return NextResponse.json(
          {
            error: signedRenominated?.error || "No se pudo firmar el PDF",
            details: signedRenominated?.details || null,
          },
          { status: 500 }
        );
      }

      await logAuditEvent({
        eventType: "TICKET_FILE_SHARED",
        userId: user.id,
        orderId: order.id,
        metadata: {
          bucket: signedRenominated.bucket,
          path: signedRenominated.path,
          source: "order-pdf-route",
          kind: "renominated",
        },
      });

      const res = NextResponse.redirect(signedRenominated.signedUrl, 302);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const resolved = await resolvePdfForTicket(admin, order.ticket_id);
    if (resolved?.error) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const candidateRef = mergeCandidateRefs(
      resolved?.candidateRef || null,
      createCandidateRef({
        bucket: resolved?.ticket?.upload_bucket || resolved?.ticket?.storage_bucket || null,
        path:
          resolved?.ticket?.upload_path ||
          resolved?.ticket?.storage_path ||
          resolved?.ticket?.pdf_path ||
          resolved?.ticket?.ticket_pdf_path ||
          resolved?.ticket?.file_path ||
          null,
      })
    );

    const signedOriginal = await createSignedUrlWithFallback(
      admin,
      candidateRef
    );

    if (!signedOriginal?.signedUrl) {
      return NextResponse.json(
        {
          error: signedOriginal?.error || "No se pudo firmar el PDF",
          details: signedOriginal?.details || null,
        },
        { status: 500 }
      );
    }

    await logAuditEvent({
      eventType: "TICKET_FILE_SHARED",
      userId: user.id,
      orderId: order.id,
      metadata: {
        bucket: signedOriginal.bucket,
        path: signedOriginal.path,
        source: "order-pdf-route",
        kind: "original",
      },
    });

    const res = NextResponse.redirect(signedOriginal.signedUrl, 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: "Error interno", details: String(e) },
      { status: 500 }
    );
  }
}
