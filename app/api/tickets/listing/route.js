// app/api/tickets/listing/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase env vars");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function getBearerToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  const [type, token] = authHeader.split(" ");
  if ((type || "").toLowerCase() !== "bearer") return null;
  return token || null;
}

function calcPlatformFeeCLP(priceCLP) {
  const p = Math.round(Number(priceCLP) || 0);
  if (!p || p <= 0) return 0;
  return Math.max(Math.round(p * 0.025), 1200);
}

async function getTicketColumns() {
  // Traemos solo las columnas que nos importan (schema-safe)
  const { data, error } = await supabaseAdmin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "tickets")
    .in("column_name", ["price", "price_clp", "platform_fee", "notes", "status", "deleted_at"]);

  if (error) throw error;

  const set = new Set((data || []).map((c) => c.column_name));
  return set;
}

/**
 * PATCH /api/tickets/listing
 * Editar una publicación (precio, estado)
 * Body: { ticketId, price?, status?, notes? }
 */
export async function PATCH(request) {
  try {
    // Auth
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { ticketId, price, status, notes } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    // Verificar ownership
    const { data: ticket, error: fetchErr } = await supabaseAdmin
      .from("tickets")
      .select("id, seller_id, status, price, price_clp")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }

    if (ticket.seller_id !== userId) {
      return NextResponse.json(
        { error: "No tienes permiso para editar esta publicación" },
        { status: 403 }
      );
    }

    // Schema-safe: detectamos columnas dentro del handler (IMPORTANTE: no fuera, por el build)
    let cols;
    try {
      cols = await getTicketColumns();
    } catch (schemaErr) {
      console.error("[listing PATCH] Schema detection error:", schemaErr);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    const hasPrice = cols.has("price");
    const hasPriceClp = cols.has("price_clp");
    const hasPlatformFee = cols.has("platform_fee");
    const hasNotes = cols.has("notes");
    const hasStatus = cols.has("status");

    // Construir updates
    const updates = {};

    // Precio
    if (price !== undefined) {
      const parsedPrice = Math.round(Number(price) || 0);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }

      // ✅ Sincroniza price y price_clp si existen
      if (hasPrice) updates.price = parsedPrice;
      if (hasPriceClp) updates.price_clp = parsedPrice;

      if (!hasPrice && !hasPriceClp) {
        return NextResponse.json(
          { error: "No existe columna de precio (price/price_clp) en tickets" },
          { status: 500 }
        );
      }

      // ✅ Fee correcto: 2.5% con mínimo 1200
      if (hasPlatformFee) {
        updates.platform_fee = calcPlatformFeeCLP(parsedPrice);
      }
    }

    // Estado
    if (status !== undefined) {
      if (!hasStatus) {
        return NextResponse.json(
          { error: "La tabla tickets no tiene columna status" },
          { status: 500 }
        );
      }

      const validStatuses = ["active", "available", "paused", "sold", "cancelled", "held"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Estado inválido. Usa: active, available, paused, sold, cancelled, held" },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    // Notas
    if (notes !== undefined) {
      if (hasNotes) {
        updates.notes = String(notes || "").substring(0, 500);
      }
      // si no existe notes, lo ignoramos para no romper schema
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
    }

    // Update
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("tickets")
      .update(updates)
      .eq("id", ticketId)
      .select()
      .single();

    if (updateErr) {
      console.error("[listing PATCH] Update error:", updateErr);
      return NextResponse.json(
        { error: "Error al actualizar publicación", details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, ticket: updated }, { status: 200 });
  } catch (err) {
    console.error("[listing PATCH] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/tickets/listing
 * Eliminar una publicación
 * Body: { ticketId }
 */
export async function DELETE(request) {
  try {
    // Auth
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { ticketId } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    // Verificar ownership y estado
    const { data: ticket, error: fetchErr } = await supabaseAdmin
      .from("tickets")
      .select("id, seller_id, status")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }

    if (ticket.seller_id !== userId) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar esta publicación" },
        { status: 403 }
      );
    }

    // Bloquear eliminación si está vendida
    if (ticket.status === "sold") {
      return NextResponse.json(
        { error: "No puedes eliminar una publicación vendida. Contacta a soporte si necesitas ayuda." },
        { status: 400 }
      );
    }

    // Detectar deleted_at (soft delete)
    let cols;
    try {
      cols = await getTicketColumns();
    } catch (schemaErr) {
      console.error("[listing DELETE] Schema detection error:", schemaErr);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    const hasDeletedAt = cols.has("deleted_at");
    const hasStatus = cols.has("status");

    if (hasDeletedAt) {
      const updates = { deleted_at: new Date().toISOString() };
      if (hasStatus) updates.status = "cancelled";

      const { error: softDeleteErr } = await supabaseAdmin
        .from("tickets")
        .update(updates)
        .eq("id", ticketId);

      if (softDeleteErr) {
        console.error("[listing DELETE] Soft delete error:", softDeleteErr);
        return NextResponse.json({ error: "Error al eliminar publicación" }, { status: 500 });
      }
    } else {
      const { error: deleteErr } = await supabaseAdmin
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (deleteErr) {
        console.error("[listing DELETE] Hard delete error:", deleteErr);
        return NextResponse.json({ error: "Error al eliminar publicación" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Publicación eliminada" }, { status: 200 });
  } catch (err) {
    console.error("[listing DELETE] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

