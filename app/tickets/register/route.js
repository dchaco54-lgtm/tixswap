import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs"; // importante para crypto + Buffer

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

export async function POST(req) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) return json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const form = await req.formData();
    const file = form.get("file");
    const userId = (form.get("userId") || "").toString() || "anon";
    const isNominated = (form.get("isNominated") || "false").toString() === "true";

    if (!file) return json({ error: "Missing file" }, 400);
    if (!(file instanceof File)) return json({ error: "Invalid file" }, 400);

    // Validación básica
    if (file.type !== "application/pdf") {
      return json({ error: "Solo PDF (application/pdf)" }, 400);
    }
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return json({ error: "PDF supera 8MB" }, 400);
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    // Verifica header PDF real
    const header = buf.subarray(0, 5).toString("utf8");
    if (header !== "%PDF-") {
      return json({ error: "Archivo no parece un PDF válido" }, 400);
    }

    // Hash anti-duplicado
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    // 1) Revisar duplicado en DB
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("ticket_uploads")
      .select("id, sha256, file_path, created_at")
      .eq("sha256", sha256)
      .maybeSingle();

    if (existingErr) {
      return json({ error: "DB duplicate-check failed", details: existingErr.message }, 500);
    }

    const bucket = "ticket-pdfs";
    const filePath = `tickets/${userId}/${sha256}.pdf`;

    // Si ya existe, devolvemos 409 + link para verlo (signed url)
    if (existing) {
      const { data: signed, error: signedErr } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(existing.file_path, 60 * 30);

      return json(
        {
          error: "DUPLICATE",
          message: "Entrada ya subida en Tixswap",
          sha256: existing.sha256,
          existing: {
            id: existing.id,
            filePath: existing.file_path,
            createdAt: existing.created_at,
            viewUrl: signedErr ? null : signed?.signedUrl || null,
          },
        },
        409
      );
    }

    // 2) Subir a Storage (no upsert para no pisar)
    const { error: uploadErr } = await supabaseAdmin.storage.from(bucket).upload(filePath, buf, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadErr) {
      // Si storage dice "already exists", lo tratamos como duplicate amable
      const msg = uploadErr.message || "";
      if (msg.toLowerCase().includes("already exists")) {
        const { data: signed } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 30);

        return json(
          {
            error: "DUPLICATE",
            message: "Entrada ya subida en Tixswap",
            sha256,
            existing: { filePath, viewUrl: signed?.signedUrl || null },
          },
          409
        );
      }
      return json({ error: "Storage upload failed", details: uploadErr.message }, 500);
    }

    // 3) Registrar en DB
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("ticket_uploads")
      .insert({
        user_id: userId === "anon" ? null : userId,
        sha256,
        file_path: filePath,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        is_nominated: isNominated,
      })
      .select("id, sha256, file_path, created_at")
      .single();

    if (insertErr) {
      // rollback: si no pudimos insertar, borramos el archivo para no dejar basura
      await supabaseAdmin.storage.from(bucket).remove([filePath]);
      return json({ error: "DB insert failed", details: insertErr.message }, 500);
    }

    // 4) Signed URL para verlo (debug / UX)
    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 30);

    return json({
      ok: true,
      id: inserted.id,
      sha256,
      filePath,
      viewUrl: signedErr ? null : signed?.signedUrl || null,
      createdAt: inserted.created_at,
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}

export async function GET(req) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) return json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const sha256 = url.searchParams.get("sha256");
    if (!sha256) return json({ error: "Missing sha256" }, 400);

    const { data: row, error } = await supabaseAdmin
      .from("ticket_uploads")
      .select("file_path")
      .eq("sha256", sha256)
      .maybeSingle();

    if (error) return json({ error: "DB read failed", details: error.message }, 500);
    if (!row) return json({ error: "Not found" }, 404);

    const bucket = "ticket-pdfs";
    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(row.file_path, 60 * 30);

    if (signedErr) return json({ error: "SignedUrl failed", details: signedErr.message }, 500);

    return json({ ok: true, viewUrl: signed?.signedUrl || null, filePath: row.file_path });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
