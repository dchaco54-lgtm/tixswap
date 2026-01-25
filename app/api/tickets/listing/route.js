// app/api/tickets/listing/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateFees } from "@/lib/fees";

export const runtime = "nodejs";

function getBearer(req) {
  const auth = req.headers.get("authorization") || "";
  const [type, token] = auth.split(" ");
  if ((type || "").toLowerCase() !== "bearer") return null;
  return token || null;
}

export async function PATCH(req) {
  try {
    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: uErr,
    } = await admin.auth.getUser(token);

    if (uErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ticketId, status, price, notes } = body || {};

    if (!ticketId) return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });

    // Validar que el ticket sea del usuario
    const { data: existing, error: exErr } = await admin
      .from("tickets")
      .select("id,seller_id,status,price,price_clp")
      .eq("id", ticketId)
      .single();

    if (exErr || !existing) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    if (existing.seller_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    // Construir update object solo con campos válidos
    // Ojo: en la DB existen ambos campos price y price_clp, y si no los sincronizas
    // el dashboard se queda mostrando el price_clp viejo (tu bug de 1.300 “pegado”).
    const updates = {};
    if (typeof status === "string") updates.status = status;
    if (typeof notes === "string") updates.notes = notes;

    // precio y fee
    if (price !== undefined && price !== null && price !== "") {
      const p = Math.round(Number(price) || 0);
      if (p <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

      // ✅ Sincronizar SIEMPRE
      updates.price = p;
      updates.price_clp = p;

      // ✅ Fee correcto: 2.5% con mínimo 1200
      const { platformFee } = calculateFees(p);
      updates.platform_fee = platformFee;
    }

    // Si no hay nada que actualizar
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, ticket: existing }, { status: 200 });
    }

    // Intento update “completo”
    let { data: updated, error: upErr } = await admin
      .from("tickets")
      .update(updates)
      .eq("id", ticketId)
      .select("*")
      .single();

    // Fallback si alguna columna no existe en algún ambiente (dev/old schema)
    if (upErr && /column .*price_clp.* does not exist/i.test(upErr.message || "")) {
      const safeUpdates = { ...updates };
      delete safeUpdates.price_clp;

      const retry = await admin.from("tickets").update(safeUpdates).eq("id", ticketId).select("*").single();
      updated = retry.data;
      upErr = retry.error;
    }

    if (upErr) throw upErr;

    return NextResponse.json({ ok: true, ticket: updated }, { status: 200 });
  } catch (e) {
    console.error("listing PATCH error", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: uErr,
    } = await admin.auth.getUser(token);

    if (uErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ticketId } = body || {};

    if (!ticketId) return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });

    // Validar que el ticket sea del usuario
    const { data: existing, error: exErr } = await admin.from("tickets").select("id,seller_id").eq("id", ticketId).single();

    if (exErr || !existing) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    if (existing.seller_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    // Schema-safe: detect columns listing_status / is_listed, si existen
    const { data: cols, error: cErr } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "tickets")
      .in("column_name", ["listing_status", "is_listed", "status"]);

    if (cErr) throw cErr;

    const colNames = new Set((cols || []).map((c) => c.column_name));
    const updates = {};

    if (colNames.has("listing_status")) updates.listing_status = "inactive";
    if (colNames.has("is_listed")) updates.is_listed = false;
    // fallback: set status = cancelled if exists
    if (colNames.has("status")) updates.status = "cancelled";

    const { error: delErr } = await admin.from("tickets").update(updates).eq("id", ticketId);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("listing DELETE error", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

