export const STATUS_LABELS = {
  in_review: "En revisión",
  pending_info: "Pendiente de antecedentes",
  open: "Abierto",
  resolved: "Resuelto",
  closed: "Cerrado",
  rejected: "Rechazado",
};

export const CAN_CHAT_STATUSES = new Set(["in_review", "pending_info", "open"]);

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? "—";
}

export function canChat(status) {
  return CAN_CHAT_STATUSES.has(status);
}
