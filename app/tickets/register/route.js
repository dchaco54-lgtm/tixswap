import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();

    const sha256 = String(body?.sha256 || "").trim();
    const storage_path = String(body?.storage_path || "").trim();
    const event_id = body?.event_id;
    const owner_user_id = body?.owner_user_id;
    const is_nominated = !!body?.is_nominated;

    if (!sha256 || sha256.length < 32) {
      return NextResponse.json({ error: "sha256 inválido" }, { status: 400 });
    }
    if (!storage_path) {
      return NextResponse.json({ error: "storage_path requerido" }, { status: 400 });
    }
    if (!event_id || !owner_user_id) {
      return NextResponse.json({ error: "event_id / owner_user_id requeridos" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const insertObj = {
      owner_user_id,
      event_id,
      sha256,
      storage_bucket: "ticket-pdfs",
      storage_path,
      original_filename: body?.original_filename ?? null,
      size_bytes: body?.size_bytes ?? null,
      is_nominated,
      status: "active",
    };

    const { data, error } = await supabase
      .from("ticket_files")
      .insert(insertObj)
      .select("id")
      .single();

    if (error) {
      // UNIQUE violation (depende del mensaje, pero esto suele funcionar bien)
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("ticket_files_sha256_unique")) {
        return NextResponse.json({ error: "Entrada ya subida en Tixswap" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
