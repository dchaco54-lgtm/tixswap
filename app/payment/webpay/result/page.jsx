import Link from "next/link";

import RedirectCountdown from "./RedirectCountdown";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeAmount(order) {
  return Number(
    order?.total_paid_clp ??
      order?.total_clp ??
      order?.total_amount ??
      order?.amount_clp ??
      order?.amount ??
      0
  );
}

function paymentTypeLabel(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized === "VD") return "Débito";
  if (normalized === "VN") return "Crédito";
  if (normalized === "VC") return "Crédito en cuotas";
  if (normalized === "SI") return "Sin interés";
  return normalized || null;
}

export default async function WebpayResultPage({ searchParams }) {
  const orderId = String(searchParams?.orderId || "").trim() || null;
  const admin = supabaseAdmin();

  let order = null;
  let ticket = null;
  let event = null;

  if (orderId) {
    const { data } = await admin
      .from("orders")
      .select(
        "id, buy_order, ticket_id, event_id, status, payment_state, amount, amount_clp, total_amount, total_clp, total_paid_clp, currency, paid_at, webpay_authorization_code, webpay_card_last4, webpay_payment_type_code"
      )
      .eq("id", orderId)
      .maybeSingle();

    order = data || null;
  }

  if (order?.ticket_id) {
    const { data } = await admin
      .from("tickets")
      .select("id, event_id, sector, row_label, seat_label")
      .eq("id", order.ticket_id)
      .maybeSingle();
    ticket = data || null;
  }

  const eventId = order?.event_id || ticket?.event_id || null;
  if (eventId) {
    const { data } = await admin
      .from("events")
      .select("id, title, venue, city, starts_at")
      .eq("id", eventId)
      .maybeSingle();
    event = data || null;
  }

  const isApproved =
    String(order?.status || "").toLowerCase() === "paid" ||
    String(order?.payment_state || "").toUpperCase() === "AUTHORIZED";
  const title = isApproved ? "Pago aprobado" : "Pago no completado";
  const amount = normalizeAmount(order);
  const paymentType = paymentTypeLabel(order?.webpay_payment_type_code);

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        {isApproved ? "✅" : "⚠️"} {title}
      </h1>

      {!order ? (
        <p className="text-gray-600 mb-6">
          No encontramos información suficiente para mostrar el resultado.
        </p>
      ) : (
        <div className="border rounded p-4 mb-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span>Orden interna</span>
            <span className="font-mono">{order.id}</span>
          </div>

          {!!order.buy_order && (
            <div className="flex justify-between">
              <span>Orden Webpay</span>
              <span className="font-mono">{order.buy_order}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Monto</span>
            <span>{amount.toLocaleString("es-CL")} CLP</span>
          </div>

          <div className="flex justify-between">
            <span>Estado interno</span>
            <span>{order.status || order.payment_state || "-"}</span>
          </div>

          {!!order.webpay_authorization_code && (
            <div className="flex justify-between">
              <span>Código de autorización</span>
              <span className="font-mono">{order.webpay_authorization_code}</span>
            </div>
          )}

          {!!paymentType && (
            <div className="flex justify-between">
              <span>Tipo de pago</span>
              <span>{paymentType}</span>
            </div>
          )}

          {!!order.webpay_card_last4 && (
            <div className="flex justify-between">
              <span>Últimos 4 dígitos</span>
              <span>**** {order.webpay_card_last4}</span>
            </div>
          )}

          {!!order.paid_at && (
            <div className="flex justify-between">
              <span>Fecha</span>
              <span>{new Date(order.paid_at).toLocaleString("es-CL")}</span>
            </div>
          )}

          {event?.title ? (
            <div className="pt-2 border-t">
              <div className="font-medium">{event.title}</div>
              <div className="text-gray-600">
                {[event.venue, event.city].filter(Boolean).join(" · ")}
              </div>
            </div>
          ) : null}

          {ticket ? (
            <div className="text-gray-600">
              {[ticket.sector, ticket.row_label, ticket.seat_label]
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex gap-3">
        <Link
          className="tix-btn"
          href={order?.id ? `/dashboard/purchases/${order.id}` : "/dashboard/purchases"}
        >
          Ir a mis compras
        </Link>

        {!isApproved && order?.ticket_id ? (
          <Link className="tix-btn-outline" href={`/checkout/${order.ticket_id}`}>
            Intentar nuevamente
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <RedirectCountdown
          seconds={5}
          redirectUrl={order?.id ? `/dashboard/purchases/${order.id}` : "/dashboard/purchases"}
        />
      </div>
    </div>
  );
}
