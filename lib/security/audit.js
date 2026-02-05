import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function logAuditEvent({
  eventType,
  userId = null,
  orderId = null,
  metadata = {},
}) {
  if (!eventType) return;

  try {
    const admin = supabaseAdmin();
    const payload = {
      event_type: eventType,
      user_id: userId,
      order_id: orderId,
      metadata,
    };

    const { error } = await admin.from("audit_events").insert(payload);
    if (error) {
      console.warn("[audit] insert skipped:", error.message);
    }
  } catch (err) {
    console.warn("[audit] unexpected error:", err?.message || err);
  }
}
