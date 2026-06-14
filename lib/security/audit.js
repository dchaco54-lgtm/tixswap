import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Catálogo de eventos auditables (ISO 27001 / PCI DSS)
export const AUDIT_EVENTS = Object.freeze({
  // Autenticación
  LOGIN_SUCCESS:          'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILED:           'AUTH_LOGIN_FAILED',
  LOGOUT:                 'AUTH_LOGOUT',
  PASSWORD_RESET_REQUEST: 'AUTH_PASSWORD_RESET_REQUEST',

  // Pagos (PCI DSS requiere log de toda transacción)
  PAYMENT_INITIATED:      'PAYMENT_INITIATED',
  PAYMENT_SUCCESS:        'PAYMENT_SUCCESS',
  PAYMENT_FAILED:         'PAYMENT_FAILED',
  PAYMENT_CANCELED:       'PAYMENT_CANCELED',
  PAYOUT_BATCH_CREATED:   'PAYOUT_BATCH_CREATED',

  // Tickets
  TICKET_PUBLISHED:       'TICKET_PUBLISHED',
  TICKET_SOLD:            'TICKET_SOLD',
  TICKET_FILE_SHARED:     'TICKET_FILE_SHARED',

  // Órdenes
  ORDER_DISPUTED:         'ORDER_DISPUTED',
  ORDER_APPROVED:         'ORDER_APPROVED',

  // Cuenta bancaria
  WALLET_SAVED:           'WALLET_SAVED',

  // Admin
  ADMIN_APPROVE_REQUEST:  'ADMIN_APPROVE_REQUEST',
  ADMIN_REJECT_REQUEST:   'ADMIN_REJECT_REQUEST',
  ADMIN_EVENT_EDIT:       'ADMIN_EVENT_EDIT',
});

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
