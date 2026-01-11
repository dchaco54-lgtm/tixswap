// app/api/tickets/[id]/pdf/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req, { params }) {
  try {
    const ticketId = params?.id;

    if (!ticketId) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let admin = null;
    try {
      admin = supabaseAdmin();
    } catch {
      // si no hay service role, seguimos con usuario (puede fallar si storage es privado)
    }

    const client = admin || supabaseUser;

    // ---- Auth check (best effort) ----
    let allowed = false;

    const { data: orderMaybe, error: orderErr } = await client
      .from("orders")
      .select("id,buyer_id,seller_id,ticket_id")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!orderErr && orderMaybe) {
      if (orderMaybe.buyer_id === user.id || orderMaybe.seller_id === user.id) {
        allowed = true;
      }
    }

    let ticketRow = null;
    if (!allowed) {
      const { data: t, error: tErr } = await client
        .from("tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();

      if (!tErr && t) {
        ticketRow = t;
        if (t.seller_id === user.id) allowed = true;
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ---- Locate file ----
    let bucket = "ticket-pdfs";
    let path = null;

    // 1) ticket_files
    const { data: tf, error: tfErr } = await client
      .from("ticket_files")
      .select("storage_bucket,storage_path")
      .eq("id", ticketId)
      .maybeSingle();

    if (!tfErr && tf?.storage_path) {
      bucket = tf.storage_bucket || bucket;
      path = tf.storage_path;
    }

    // 2) ticket_uploads (id == ticketId)
    if (!path) {
      const { data: tu, error: tuErr } = await client
        .from("ticket_uploads")
        .select("storage_bucket,storage_path")
        .eq("id", ticketId)
        .maybeSingle();

      if (!tuErr && tu?.storage_path) {
        bucket = tu.storage_bucket || bucket;
        path = tu.storage_path;
      }
    }

    // 3) tickets.storage_path / bucket
    if (!path && ticketRow) {
      if (ticketRow.storage_path) {
        bucket = ticketRow.storage_bucket || bucket;
        path = ticketRow.storage_path;
      }
    }

    // 4) tickets.ticket_upload_id -> ticket_uploads
    if (!path && ticketRow?.ticket_upload_id) {
      const { data: tu2, error: tu2Err } = await client
        .from("ticket_uploads")
        .select("storage_bucket,storage_path")
        .eq("id", ticketRow.ticket_upload_id)
        .maybeSingle();

      if (!tu2Err && tu2?.storage_path) {
        bucket = tu2.storage_bucket || bucket;
        path = tu2.storage_path;
      }
    }

    // 5) fallback
    if (!path) {
      path = `${ticketId}.pdf`;
    }

    const { data: signed, error: signErr } = await client.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 min

    if (signErr || !signed?.signedUrl) {
      console.error("ticket pdf signErr:", signErr);
      return NextResponse.json(
        {
          error:
            "No se pudo generar el link del PDF. Revisa que el archivo exista en Storage (ticket-pdfs) y que tenga storage_path válido.",
          details: signErr?.message || null,
          bucket,
          path,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ signedUrl: signed.signedUrl, bucket, path });
  } catch (err) {
    console.error("ticket pdf fatal:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
