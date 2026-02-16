// ============================================
// HELPER: Sistema de Estados de Soporte TixSwap
// ============================================
// Estados estandarizados para tickets de soporte.
// Mantener consistencia entre DB, APIs y UI.

/**
 * Estados válidos en base de datos
 */
export const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_USER: 'waiting_user',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

/**
 * Labels en español para mostrar en UI
 */
export const STATUS_LABELS = {
  open: "Abierto",
  in_progress: "En progreso",
  waiting_user: "Esperando respuesta",
  resolved: "Resuelto",
  closed: "Cerrado",
  
  // Legacy (para compatibilidad)
  in_review: "En revisión",
  pending_info: "Pendiente de antecedentes",
  rejected: "Rechazado",
  submitted: "Enviado",
  waiting_support: "En progreso",
  abierto: "Abierto", // conversión legacy
};

/**
 * Estados en los que el usuario puede enviar mensajes
 */
export const CAN_CHAT_STATUSES = new Set([
  TICKET_STATUS.OPEN,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.WAITING_USER,
]);

/**
 * Clases de Tailwind para badges de estado
 */
export const STATUS_BADGE_CLASSES = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200",
  waiting_user: "bg-amber-50 text-amber-800 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
  
  // Legacy
  in_review: "bg-blue-50 text-blue-700 border-blue-200",
  pending_info: "bg-amber-50 text-amber-800 border-amber-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  submitted: "bg-slate-50 text-slate-700 border-slate-200",
  waiting_support: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

/**
 * Obtener label en español para un estado
 */
export function statusLabel(status) {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

/**
 * Verificar si se puede chatear en este estado
 */
export function canChat(status) {
  if (!status) return false;
  return CAN_CHAT_STATUSES.has(status);
}

/**
 * Obtener clases CSS para badge de estado
 */
export function statusBadgeClass(status) {
  if (!status) return "bg-slate-50 text-slate-700 border-slate-200";
  const base = "px-3 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1";
  const color = STATUS_BADGE_CLASSES[status] ?? "bg-slate-50 text-slate-700 border-slate-200";
  return `${base} ${color}`;
}

/**
 * Normalizar estado legacy a nuevo formato
 * Útil para migración gradual
 */
export function normalizeStatus(status) {
  if (!status) return TICKET_STATUS.OPEN;
  
  const normalized = String(status).toLowerCase().trim();
  
  const mappings = {
    'abierto': TICKET_STATUS.OPEN,
    'en_revision': TICKET_STATUS.IN_PROGRESS,
    'in_review': TICKET_STATUS.IN_PROGRESS,
    'pendiente_info': TICKET_STATUS.WAITING_USER,
    'pending_info': TICKET_STATUS.WAITING_USER,
    'pendiente_antecedentes': TICKET_STATUS.WAITING_USER,
    'waiting_support': TICKET_STATUS.IN_PROGRESS,
    'resuelto': TICKET_STATUS.RESOLVED,
    'finalizado': TICKET_STATUS.RESOLVED,
    'cerrado': TICKET_STATUS.CLOSED,
  };
  
  return mappings[normalized] ?? normalized;
}

/**
 * Verificar si estado es terminal (no se puede modificar más)
 */
export function isTerminalStatus(status) {
  return status === TICKET_STATUS.RESOLVED || status === TICKET_STATUS.CLOSED;
}

/**
 * Obtener próximos estados válidos desde un estado actual
 */
export function getNextValidStatuses(currentStatus) {
  const transitions = {
    [TICKET_STATUS.OPEN]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.WAITING_USER, TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED],
    [TICKET_STATUS.IN_PROGRESS]: [TICKET_STATUS.WAITING_USER, TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED],
    [TICKET_STATUS.WAITING_USER]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED],
    [TICKET_STATUS.RESOLVED]: [TICKET_STATUS.OPEN, TICKET_STATUS.CLOSED],
    [TICKET_STATUS.CLOSED]: [TICKET_STATUS.OPEN],
  };
  
  return transitions[currentStatus] ?? [];
}
