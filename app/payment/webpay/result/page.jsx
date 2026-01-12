import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import RedirectCountdown from "./RedirectCountdown";

export default async function WebpayResultPage({ searchParams }) {
  const status = searchParams?.status || "unknown";
  const orderId = searchParams?.orderId || null;
  const token = searchParams?.token || null;

  const isApproved = status === "approved";
  const admin = supabaseAdmin();

  let order = null;

  if (orderId) {
    const { data } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
    order = data || null;
  } else if (token) {
    const { data } = await admin.from("orders").select("*").eq("webpay_token", token).maybeSingle();
    order = data || null;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        {isApproved ? "✅ Pago aprobado" : "⚠️ Pago no completado"}
      </h1>

      <p className="text-gray-600 mb-4">
        Estado recibido: <b>{status}</b>
      </p>

      {order && (
        <div className="border rounded p-4 mb-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span>Orden</span>
            <span className="font-mono">{order.id}</span>
          </div>

          {!!order.buy_order && (
            <div className="flex justify-between">
              <span>BuyOrder</span>
              <span className="font-mono">{order.buy_order}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Monto</span>
            <span>
              $
              {Number(
                order.total_paid_clp ??
                  order.total_amount ??
                  order.amount_clp ??
                  order.amount ??
                  0
              ).toLocaleString("es-CL")}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Status interno</span>
            <span>{order.status || order.payment_state}</span>
          </div>

          {isApproved && (
            <>
              {!!order.webpay_authorization_code && (
                <div className="flex justify-between">
                  <span>Autorización</span>
                  <span className="font-mono">{order.webpay_authorization_code}</span>
                </div>
              )}

              {!!order.webpay_card_last4 && (
                <div className="flex justify-between">
                  <span>Tarjeta</span>
                  <span>**** {order.webpay_card_last4}</span>
                </div>
              )}

              {!!order.paid_at && (
                <div className="flex justify-between">
                  <span>Fecha</span>
                  <span>{new Date(order.paid_at).toLocaleString("es-CL")}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Link className="tix-btn" href={isApproved ? "/dashboard" : "/"}>
          {isApproved ? "Ir al dashboard" : "Volver al inicio"}
        </Link>

        {!isApproved && order?.ticket_id && (
          <Link className="tix-btn-outline" href={`/tickets/${order.ticket_id}`}>
            Intentar nuevamente
          </Link>
        )}
      </div>

      <div className="mt-4">
        <RedirectCountdown seconds={5} redirectUrl={isApproved ? "/dashboard" : "/"} />
      </div>
    </div>
  );
}
