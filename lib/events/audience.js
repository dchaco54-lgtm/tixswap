const ACTIVE_ORDER_STATUSES = new Set([
  "paid",
  "pending_payment",
  "processing",
  "held",
  "buyer_ok",
  "delivered",
  "completed",
  "disputed",
]);

const ACTIVE_TICKET_STATUSES = new Set(["active", "available"]);

function normalizeStatus(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizePaymentState(value) {
  return String(value || "").toUpperCase().trim();
}

function isActiveOrder(order) {
  const status = normalizeStatus(order?.status);
  const paymentState = normalizePaymentState(order?.payment_state);
  if (ACTIVE_ORDER_STATUSES.has(status)) return true;
  if (status && ["canceled", "failed", "expired"].includes(status)) return false;
  if (paymentState === "AUTHORIZED") return true;
  if (order?.paid_at) return true;
  return false;
}

export async function getEventAudience(admin, eventId, opts = {}) {
  const includeSellers = Boolean(opts.includeSellers);

  const buyers = new Set();
  const subscribers = new Set();
  const sellers = new Set();

  const { data: tickets, error: ticketsErr } = await admin
    .from("tickets")
    .select("id, seller_id, status")
    .eq("event_id", eventId);

  if (ticketsErr) throw ticketsErr;

  const ticketRows = Array.isArray(tickets) ? tickets : [];
  const ticketIds = ticketRows.map((t) => t.id).filter(Boolean);

  if (includeSellers) {
    ticketRows.forEach((t) => {
      const status = normalizeStatus(t.status);
      if (!ACTIVE_TICKET_STATUSES.has(status)) return;
      if (t.seller_id) sellers.add(t.seller_id);
    });
  }

  const orders = [];

  const { data: ordersByEvent, error: ordersEventErr } = await admin
    .from("orders")
    .select("id, buyer_id, user_id, status, payment_state, paid_at, ticket_id")
    .eq("event_id", eventId);

  if (ordersEventErr) throw ordersEventErr;
  if (Array.isArray(ordersByEvent)) orders.push(...ordersByEvent);

  if (ticketIds.length) {
    const { data: ordersByTickets, error: ordersTicketsErr } = await admin
      .from("orders")
      .select("id, buyer_id, user_id, status, payment_state, paid_at, ticket_id")
      .in("ticket_id", ticketIds);

    if (ordersTicketsErr) throw ordersTicketsErr;
    if (Array.isArray(ordersByTickets)) orders.push(...ordersByTickets);
  }

  const seenOrders = new Set();
  orders.forEach((o) => {
    if (!o || !o.id || seenOrders.has(o.id)) return;
    seenOrders.add(o.id);
    if (!isActiveOrder(o)) return;
    const buyerId = o.buyer_id || o.user_id;
    if (buyerId) buyers.add(buyerId);
  });

  const { data: subs, error: subsErr } = await admin
    .from("event_alert_subscriptions")
    .select("user_id")
    .eq("event_id", eventId);

  if (subsErr) throw subsErr;
  (subs || []).forEach((s) => {
    if (s?.user_id) subscribers.add(s.user_id);
  });

  const total = new Set([...buyers, ...subscribers, ...sellers]);

  return {
    buyers,
    subscribers,
    sellers,
    total,
    buyersCount: buyers.size,
    subscribersCount: subscribers.size,
    sellersCount: sellers.size,
    totalUniqueCount: total.size,
  };
}
