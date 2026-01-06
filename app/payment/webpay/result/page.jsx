import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import RedirectCountdown from "./RedirectCountdown";

export default async function WebpayResultPage({ searchParams }) {
  const token = searchParams?.token;
  const status = searchParams?.status;

  let payment = null;

  if (token) {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("payment_transactions")
      .select("id, status, amount_clp, order_id, ticket_id, created_at")
      .eq("webpay_token", token)
      .single();

    payment = data || null;
  }

  const isApproved = status === "approved";

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        {isApproved ? "✅ Pago aprobado" : "⚠️ Pago no completado"}
      </h1>

      <p className="text-gray-600 mb-4">
        Estado recibido: <b>{status || "desconocido"}</b>
      </p>

      {payment && (
        <div className="border rounded p-4 mb-4 text-sm">
          <div className="flex justify-between">
            <span>ID Transacción</span>
            <span className="font-mono">{payment.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Monto</span>
            <span>${Number(payment.amount_clp || 0).toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between">
            <span>Status interno</span>
            <span>{payment.status}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link className="tix-btn" href={isApproved ? "/dashboard" : "/"}>
          {isApproved ? "Ir al dashboard" : "Volver al inicio"}
        </Link>

        {!isApproved && payment?.ticket_id && (
          <Link className="tix-btn-outline" href={`/tickets/${payment.ticket_id}`}>
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
