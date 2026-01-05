import Link from "next/link";
import RedirectCountdown from "./RedirectCountdown";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 }).format(Number(n||0));
}

export default async function WebpayResultPage({ searchParams }) {
  const status = String(searchParams?.status || "unknown");
  const orderId = searchParams?.orderId ? String(searchParams.orderId) : null;

  let order = null;
  if (orderId) {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("orders")
      .select("id,buy_order,total_paid_clp,total_amount,paid_at,webpay_authorization_code,webpay_payment_type_code,webpay_installments_number,webpay_card_last4")
      .eq("id", orderId)
      .maybeSingle();
    order = data;
  }

  const ok = status === "approved";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className={`border rounded-2xl p-6 ${ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
        <h1 className="text-2xl font-bold">{ok ? "Pago aprobado ✅" : "Pago no completado ❌"}</h1>
        <p className="mt-2 text-slate-700">TixSwap - comprobante de pago</p>

        <div className="mt-6 bg-white border rounded-xl p-4">
          <p><b>Orden:</b> {order?.buy_order || "—"}</p>
          <p><b>Monto:</b> {formatCLP(order?.total_paid_clp ?? order?.total_amount)}</p>
          <p><b>Autorización:</b> {order?.webpay_authorization_code || "—"}</p>
          <p><b>Tipo pago:</b> {order?.webpay_payment_type_code || "—"}</p>
          <p><b>Cuotas:</b> {order?.webpay_installments_number ?? "—"}</p>
          <p><b>Tarjeta:</b> {order?.webpay_card_last4 ? `•••• ${order.webpay_card_last4}` : "—"}</p>
          <p><b>Fecha:</b> {order?.paid_at ? new Date(order.paid_at).toLocaleString("es-CL") : "—"}</p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <RedirectCountdown to="/dashboard/purchases" seconds={5} />
          <Link className="px-5 py-2 rounded-full bg-blue-600 text-white font-semibold" href="/dashboard/purchases">
            Ir ahora
          </Link>
        </div>
      </div>
    </div>
  );
}
