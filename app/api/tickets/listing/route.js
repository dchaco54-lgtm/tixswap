// app/api/tickets/listing/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateFees } from "@/lib/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminOrResponse() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      error: NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 }),
    };
  }

  return {
    admin: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    }),
  };
}

async function getTicketsColumnSet(admin) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "tickets");

  if (error) return new Set();
  return new Set((data || []).map((x) => x.column_name));
}

function normalizeStatus(input) {
  const s = String(input || "").trim().toLowerCase();
  // soporta strings “humanos” por si el front manda algo raro
  const map = {
    activa: "active",
    activo: "active",
    disponible: "available",
    pausada: "paused",
    pausado: "paused",
    vendida: "sold",
    cancelada: "cancelled",
  };
  return map[s] || s;
}

function buildOwnerOrClause(cols, userId) {
  const ownerCols = ["seller_id", "owner_id", "user_id"].filter((c) => cols.has(c));
  if (!ownerCols.length) return null;
  return ownerCols.map((c) => `${c}.eq.${userId}`).join(",");
}

/**
 * PATCH /api/tickets/listing
 * Body: { ticketId, price?, status?, notes? }
 */
export async function PATCH(request) {
  try {
    const { admin, error } = getAdminOrResponse();
    if (error) return error;
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    const userId = authData.user.id;

    const cols = await getTicketsColumnSet(admin);

    // Body
    const body = await request.json().catch(() => ({}));
    const { ticketId, price, status, notes } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    // Fetch ticket (sin asumir columnas)
    const selectFields = ["id", "status", "seller_id", "owner_id", "user_id"].filter((f) => cols.has(f));
    const sel = selectFields.length ? selectFields.join(",") : "id";

    const { data: ticket, error: fetchErr } = await admin
      .from("tickets")
      .select(sel)
      .eq("id", ticketId)
      .maybeSingle();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }

    // Ownership (seller/owner/user)
    const ownerOr = buildOwnerOrClause(cols, userId);
    if (ownerOr) {
      // validamos ownership “de verdad”
      const { data: ownRow } = await admin
        .from("tickets")
        .select("id")
        .eq("id", ticketId)
        .or(ownerOr)
        .maybeSingle();

      if (!ownRow) {
        return NextResponse.json({ error: "No tienes permiso para editar esta publicación" }, { status: 403 });
      }
    }

    const updates = {};

    // Price update (actualiza price y/o price_clp si existen)
    if (price !== undefined) {
      const numPrice = Math.round(Number(price));
      if (!Number.isFinite(numPrice) || numPrice <= 0) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }

      if (cols.has("price")) updates.price = numPrice;
      if (cols.has("price_clp")) updates.price_clp = numPrice;

      // Fee fijo: 2.5% min 1200
      const fees = calculateFees(numPrice);
      if (cols.has("platform_fee")) updates.platform_fee = fees.platformFee;
      if (cols.has("platform_fee_clp")) updates.platform_fee_clp = fees.platformFee;
    }

    // Status update
    if (status !== undefined) {
      const norm = normalizeStatus(status);
      const valid = ["active", "available", "paused", "sold", "cancelled"];
      if (!valid.includes(norm)) {
        return NextResponse.json(
          { error: "Estado inválido. Usa: active, available, paused, sold, cancelled" },
          { status: 400 }
        );
      }
      if (cols.has("status")) updates.status = norm;
    }

    // Notes update
    if (notes !== undefined && cols.has("notes")) {
      updates.notes = String(notes || "").substring(0, 500);
    }

    // updated_at si existe
    if (cols.has("updated_at")) {
      updates.updated_at = new Date().toISOString();
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
    }

    // Update + ownership filter
    let q = admin.from("tickets").update(updates).eq("id", ticketId);
    if (ownerOr) q = q.or(ownerOr);

    const { data: updated, error: upErr } = await q.select("*").maybeSingle();

    if (upErr) {
      console.error("[listing PATCH] Update error:", upErr);
      return NextResponse.json({ error: "Error al actualizar publicación", details: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ticket: updated });
  } catch (err) {
    console.error("[listing PATCH] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/tickets/listing
 * Body: { ticketId }
 */
export async function DELETE(request) {
  try {
    const { admin, error } = getAdminOrResponse();
    if (error) return error;
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    const userId = authData.user.id;

    const cols = await getTicketsColumnSet(admin);

    const body = await request.json().catch(() => ({}));
    const { ticketId } = body || {};
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    const ownerOr = buildOwnerOrClause(cols, userId);

    // Fetch ticket status (para bloquear sold)
    const selectFields = ["id", "status"].filter((f) => cols.has(f));
    const sel = selectFields.length ? selectFields.join(",") : "id";

    let qFetch = admin.from("tickets").select(sel).eq("id", ticketId);
    if (ownerOr) qFetch = qFetch.or(ownerOr);

    const { data: ticket, error: fetchErr } = await qFetch.maybeSingle();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: "Publicación no encontrada o sin permisos" }, { status: 404 });
    }

    if (String(ticket.status || "").toLowerCase() === "sold") {
      return NextResponse.json(
        { error: "No puedes eliminar una publicación vendida. Contacta a soporte si necesitas ayuda." },
        { status: 400 }
      );
    }

    // Soft delete si existe deleted_at, si no hard delete
    const hasDeletedAt = cols.has("deleted_at");

    if (hasDeletedAt) {
      let qSoft = admin
        .from("tickets")
        .update({ deleted_at: new Date().toISOString(), status: cols.has("status") ? "cancelled" : undefined })
        .eq("id", ticketId);

      if (ownerOr) qSoft = qSoft.or(ownerOr);

      const { error: sErr } = await qSoft;

      if (sErr) {
        console.error("[listing DELETE] Soft delete error:", sErr);
        return NextResponse.json({ error: "Error al eliminar publicación" }, { status: 500 });
      }
    } else {
      let qDel = admin.from("tickets").delete().eq("id", ticketId);
      if (ownerOr) qDel = qDel.or(ownerOr);

      const { error: dErr } = await qDel;

      if (dErr) {
        console.error("[listing DELETE] Hard delete error:", dErr);
        return NextResponse.json({ error: "Error al eliminar publicación" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Publicación eliminada" });
  } catch (err) {
    console.error("[listing DELETE] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

