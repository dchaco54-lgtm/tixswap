import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function createNotification({
  userId,
  type,
  title,
  body = null,
  link = null,
  metadata = null,
}) {
  if (!userId || !type || !title) return { ok: false, skipped: true };

  try {
    const admin = supabaseAdmin();
    const payload = {
      user_id: userId,
      type,
      title,
      body: body || null,
      link: link || null,
      metadata: metadata || null,
      is_read: false,
    };

    const { error } = await admin.from("notifications").insert(payload);
    if (error) {
      console.warn("[notifications] insert error:", error.message || error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (err) {
    console.warn("[notifications] unexpected error:", err);
    return { ok: false, error: err };
  }
}
