// app/api/tickets/[id]/pdf/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTicketUploadBucket, getTicketUploadEffectivePath } from "@/lib/ticketUploads";

export const runtime = "nodejs";

function normalizeValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.map(normalizeValue).filter(Boolean)));
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

async function createSignedUrlWithFallback(supabase, candidateRef, expiresIn = 60 * 10) {
  if (!candidateRef?.buckets?.length || !candidateRef?.paths?.length) {
    return { error: "FILE_NOT_FOUND" };
  }

  let lastError = null;

  for (const path of candidateRef.paths) {
    for (const bucket of candidateRef.buckets) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (!error && data?.signedUrl) {
        return { bucket, path, signedUrl: data.signedUrl };
      }
      lastError = error || lastError;
    }
  }

  return {
    error: "SIGNED_URL_ERROR",
    details: {
      message: lastError?.message || null,
      buckets: candidateRef.buckets,
      paths: candidateRef.paths,
    },
  };
}

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
      .select("*")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // 2) Verificar que sea comprador o vendedor de alguna orden con este ticket
    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status, payment_state, renominated_storage_bucket, renominated_storage_path")
      .eq("ticket_id", ticket.id)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const isBuyer = order.buyer_id === user.id;
    const isSeller = order.seller_id === user.id;
    const ticketSold = String(ticket.status || "").toLowerCase() === "sold";
    const orderPaid =
      String(order.status || "").toLowerCase() === "paid" ||
      String(order.payment_state || "").toUpperCase() === "PAID" ||
      String(order.payment_state || "").toUpperCase() === "AUTHORIZED";

    if (isSeller && (ticketSold || orderPaid)) {
      return NextResponse.json(
        {
          error: "PDF_BLOCKED_FOR_SELLER",
          message: "El vendedor no puede descargar el PDF una vez vendida la entrada.",
        },
        { status: 403 }
      );
    }

    // 3) Saber si es nominada (desde ticket_uploads)
    let isNominada = false;
    const uploadId = ticket.ticket_upload_id || ticket.ticket_uploads_id || null;
    if (uploadId) {
      const { data: tu } = await supabase
        .from("ticket_uploads")
        .select("is_nominated, is_nominada")
        .eq("id", uploadId)
        .maybeSingle();
      isNominada = Boolean(tu?.is_nominated ?? tu?.is_nominada ?? false);
    }

    // 4) Si es nominada y comprador intenta descargar pero NO existe renominado => bloquear
    if (isNominada && isBuyer && !order.renominated_storage_path) {
      return NextResponse.json(
        { error: "RENOMINATION_PENDING", message: "Ticket nominada: falta subir el PDF renominado." },
        { status: 409 }
      );
    }

    // 5) Elegir qué archivo entregar
    let candidateRef = createCandidateRef({
      bucket: ticket.storage_bucket || ticket.upload_bucket || ticket.pdf_bucket || null,
      path:
        ticket.storage_path ||
        ticket.upload_path ||
        ticket.pdf_path ||
        ticket.ticket_pdf_path ||
        ticket.file_path ||
        ticket.filepath ||
        null,
    });

    // Si hay renominado, usarlo (para buyer y seller)
    if (order.renominated_storage_path) {
      candidateRef = createCandidateRef({
        bucket: order.renominated_storage_bucket || null,
        path: order.renominated_storage_path,
      });
    }

    // Fallback: si ticket no tiene storage_path, intentar desde ticket_upload
    if (!order.renominated_storage_path && uploadId) {
      const { data: tu2 } = await supabase
        .from("ticket_uploads")
        .select("*")
        .eq("id", uploadId)
        .maybeSingle();
      const uploadCandidate = tu2
        ? createCandidateRef(
            {
              bucket: getTicketUploadBucket(tu2),
              path: getTicketUploadEffectivePath(tu2),
            },
            {
              bucket: tu2.bucket || null,
              path: tu2.path || tu2.file_path || null,
            }
          )
        : null;
      if (uploadCandidate) {
        candidateRef = uploadCandidate;
      }
    }

    if (!candidateRef) {
      return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
    }

    const signed = await createSignedUrlWithFallback(supabase, candidateRef, 60 * 10);
    if (!signed?.signedUrl) {
      return NextResponse.json(
        { error: signed?.error || "SIGNED_URL_ERROR", details: signed?.details || null },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: signed.signedUrl,
      bucket: signed.bucket,
      path: signed.path,
      isNominada,
      deliveredRenominated: !!order.renominated_storage_path,
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
