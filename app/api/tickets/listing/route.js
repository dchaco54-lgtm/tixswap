// app/api/tickets/listing/route.js
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

/**
 * PATCH /api/tickets/listing
 * Editar una publicación (precio, estado)
 * Body: { ticketId, price?, status?, notes? }
 */
// Detectar columnas reales en la tabla (hay instalaciones que tienen `price_clp` en vez de `price`)
const { data: schemaCols, error: schemaErr } = await supabaseAdmin
  .from("information_schema.columns")
  .select("column_name")
  .eq("table_schema", "public")
  .eq("table_name", "tickets")
  .in("column_name", ["price", "price_clp", "platform_fee", "platform_fee_clp", "fee_clp"]);

if (schemaErr) {
  console.error("Schema detection error", schemaErr);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

const cols = new Set((schemaCols || []).map((c) => c.column_name));
const hasPrice = cols.has("price");
const hasPriceClp = cols.has("price_clp");
const hasPlatformFee = cols.has("platform_fee");
const hasPlatformFeeClp = cols.has("platform_fee_clp");
const hasFeeClp = cols.has("fee_clp");

// Construir update object solo con campos válidos
const updates = {};

if (price !== undefined) {
  const parsedPrice = parseInt(price, 10);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }

  // ✅ Regla negocio: 2.5% con mínimo 1200
  const fee = Math.max(Math.round(parsedPrice * 0.025), 1200);

  // ✅ Actualizamos AMBOS si existen para evitar “precios pegados”
  if (hasPriceClp) updates.price_clp = parsedPrice;
  if (hasPrice) updates.price = parsedPrice;

  if (!hasPriceClp && !hasPrice) {
    return NextResponse.json(
      { error: "No existe columna de precio (price/price_clp) en tickets" },
      { status: 500 }
    );
  }

  // Si tienes columna de fee en tickets, la dejamos consistente
  if (hasPlatformFee) updates.platform_fee = fee;
  if (hasPlatformFeeClp) updates.platform_fee_clp = fee;
  if (hasFeeClp) updates.fee_clp = fee;
}

if (status !== undefined) {
  const validStatuses = ["active", "paused", "available"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  updates.status = status;
}

if (Object.keys(updates).length === 0) {
  return NextResponse.json({ error: "No hay cambios para actualizar" }, { status: 400 });
}

export async function PATCH(request) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { ticketId, price, status, notes } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    // Verificar ownership
    const { data: ticket, error: fetchErr } = await supabaseAdmin
      .from("tickets")
      .select("id, seller_id, status")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticket) {
      return NextResponse.json(
        { error: "Publicación no encontrada" },
        { status: 404 }
      );
    }

    if (ticket.seller_id !== userId) {
      return NextResponse.json(
        { error: "No tienes permiso para editar esta publicación" },
        { status: 403 }
      );
    }

    // Construir update object solo con campos válidos
    const updates = {};

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json(
          { error: "Precio inválido" },
          { status: 400 }
        );
      }
      updates.price = numPrice;
      // Calcular y guardar platform_fee
      updates.platform_fee = Math.max(Math.round(numPrice * 0.025), 1200);
    }

    if (status !== undefined) {
      const validStatuses = ["active", "available", "paused", "sold", "cancelled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Estado inválido. Usa: active, paused, sold, cancelled" },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (notes !== undefined) {
      updates.notes = String(notes || "").substring(0, 500);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No hay cambios para aplicar" },
        { status: 400 }
      );
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

    return NextResponse.json({ ticket: updated });
  } catch (err) {
    console.error("[listing PATCH] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
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
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { ticketId } = body;

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
      return NextResponse.json(
        { error: "Publicación no encontrada" },
        { status: 404 }
      );
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

    // Verificar si tiene columna deleted_at (soft delete)
    const { data: columns } = await supabaseAdmin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "tickets")
      .eq("column_name", "deleted_at");

    const hasDeletedAt = columns && columns.length > 0;

    if (hasDeletedAt) {
      // Soft delete
      const { error: softDeleteErr } = await supabaseAdmin
        .from("tickets")
        .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
        .eq("id", ticketId);

      if (softDeleteErr) {
        console.error("[listing DELETE] Soft delete error:", softDeleteErr);
        return NextResponse.json(
          { error: "Error al eliminar publicación" },
          { status: 500 }
        );
      }
    } else {
      // Hard delete
      const { error: deleteErr } = await supabaseAdmin
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (deleteErr) {
        console.error("[listing DELETE] Hard delete error:", deleteErr);
        return NextResponse.json(
          { error: "Error al eliminar publicación" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, message: "Publicación eliminada" });
  } catch (err) {
    console.error("[listing DELETE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
