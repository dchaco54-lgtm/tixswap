import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createTicketUploadSignedUrl, getTicketUploadEffectivePath } from "@/lib/ticketUploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAIL_ALLOWLIST = new Set(["soporte@tixswap.cl"]);

async function requireAdmin(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader.trim();

  if (!token) {
    return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const admin = supabaseAdmin();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const user = authData.user;
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("user_type,app_role,email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return { error: NextResponse.json({ error: profileErr.message }, { status: 500 }) };
  }

  const email = String(profile?.email || user.email || "").toLowerCase().trim();
  const isAdmin =
    String(profile?.user_type || "").toLowerCase() === "admin" ||
    String(profile?.app_role || "").toLowerCase() === "admin" ||
    ADMIN_EMAIL_ALLOWLIST.has(email);

  if (!isAdmin) {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { admin, user };
}

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { admin } = auth;
    const url = new URL(request.url);
    const eventId = url.searchParams.get("event_id") || "";
    const status = url.searchParams.get("status") || "";
    const limitRaw = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;

    let query = admin
      .from("ticket_uploads")
      .select(
        "id,user_id,seller_id,event_id,ticket_id,status,created_at,storage_bucket,storage_path,storage_path_staging,storage_path_final,filename_original,original_name,mime_type,size_bytes,file_size,sha256"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventId) query = query.eq("event_id", eventId);
    if (status) query = query.eq("status", status);

    const { data: uploads, error: uploadsErr } = await query;
    if (uploadsErr) {
      return NextResponse.json({ error: uploadsErr.message }, { status: 500 });
    }

    const eventIds = Array.from(new Set((uploads || []).map((row) => row.event_id).filter(Boolean)));
    const userIds = Array.from(
      new Set((uploads || []).map((row) => row.user_id || row.seller_id).filter(Boolean))
    );

    const [{ data: events }, { data: profiles }] = await Promise.all([
      eventIds.length
        ? admin.from("events").select("id,title,starts_at,venue,city").in("id", eventIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? admin.from("profiles").select("id,email,full_name").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const eventsById = Object.fromEntries((events || []).map((row) => [row.id, row]));
    const profilesById = Object.fromEntries((profiles || []).map((row) => [row.id, row]));

    const rows = await Promise.all(
      (uploads || []).map(async (upload) => {
        const ownerId = upload.user_id || upload.seller_id || null;
        const profile = ownerId ? profilesById[ownerId] || null : null;
        const event = upload.event_id ? eventsById[upload.event_id] || null : null;
        const signedUrl = await createTicketUploadSignedUrl(admin, upload, 60 * 15);

        return {
          ...upload,
          effective_path: getTicketUploadEffectivePath(upload),
          event,
          profile,
          signed_url: signedUrl,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      uploads: rows,
      filters: {
        event_id: eventId || null,
        status: status || null,
        limit,
      },
    });
  } catch (error) {
    console.error("[admin/uploads] error:", error);
    return NextResponse.json(
      { error: error?.message || "Error cargando uploads" },
      { status: 500 }
    );
  }
}
