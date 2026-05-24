import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromBearer, isAdminUser } from "@/lib/support/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value) {
  const str = String(value ?? "").trim();
  return str || null;
}

async function ensureAdmin(req, admin) {
  const { user, error } = await getUserFromBearer(req, admin);
  if (!user || error) return { ok: false, error: "UNAUTHORIZED" };

  const { ok } = await isAdminUser(admin, user);
  if (ok) return { ok: true, user };

  return { ok: false, error: "FORBIDDEN" };
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();
    const auth = await ensureAdmin(req, admin);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === "FORBIDDEN" ? 403 : 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeString(body?.action);

    if (action === "hide_expired") {
      const nowIso = new Date().toISOString();
      const { data: rows, error: rowsError } = await admin
        .from("events")
        .select("id")
        .lt("starts_at", nowIso)
        .or("status.is.null,status.eq.published,status.eq.active");

      if (rowsError) {
        console.error("[admin/events/bulk] hide_expired select error:", rowsError);
        return NextResponse.json(
          { error: "No pudimos buscar eventos vencidos" },
          { status: 500 }
        );
      }

      const ids = (rows || []).map((row) => row.id).filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({ ok: true, updated: 0, ids: [] });
      }

      const { error: updateError } = await admin
        .from("events")
        .update({ status: "draft" })
        .in("id", ids);

      if (updateError) {
        console.error("[admin/events/bulk] hide_expired update error:", updateError);
        return NextResponse.json(
          { error: "No pudimos ocultar los eventos vencidos" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action: "hide_expired",
        updated: ids.length,
        ids,
      });
    }

    const updatesRaw = Array.isArray(body?.updates) ? body.updates : [];

    const normalized = updatesRaw
      .map((row) => ({
        id: normalizeString(row?.id),
        image_url: normalizeString(row?.image_url),
      }))
      .filter((row) => row.id && row.image_url);

    if (!normalized.length) {
      return NextResponse.json(
        { error: "No hay filas válidas para actualizar" },
        { status: 400 }
      );
    }

    const ids = Array.from(new Set(normalized.map((row) => row.id)));
    const { data: existingRows, error: existingError } = await admin
      .from("events")
      .select("id")
      .in("id", ids);

    if (existingError) {
      console.error("[admin/events/bulk] existing error:", existingError);
      return NextResponse.json(
        { error: "No pudimos validar los eventos" },
        { status: 500 }
      );
    }

    const existingIds = new Set((existingRows || []).map((row) => row.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));
    const validUpdates = normalized.filter((row) => existingIds.has(row.id));

    let updated = 0;
    const errors = [];

    for (const row of validUpdates) {
      const { error } = await admin
        .from("events")
        .update({ image_url: row.image_url })
        .eq("id", row.id);

      if (error) {
        console.error("[admin/events/bulk] update error:", row.id, error);
        errors.push({
          id: row.id,
          message: error.message || "No se pudo actualizar image_url",
        });
        continue;
      }

      updated += 1;
    }

    return NextResponse.json({
      ok: errors.length === 0,
      requested: normalized.length,
      updated,
      missingIds,
      errors,
    });
  } catch (err) {
    console.error("[admin/events/bulk] POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
