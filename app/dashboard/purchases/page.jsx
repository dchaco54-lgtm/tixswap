"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCLP } from "@/lib/fees";

function statusLabel(s) {
  const v = (s || "").toLowerCase();
  if (v === "held") return { text: "Aprobado", cls: "bg-green-100 text-green-800" };
  if (v === "pending_review") return { text: "Pendiente / revisión", cls: "bg-yellow-100 text-yellow-800" };
  if (v === "rejected") return { text: "Rechazado", cls: "bg-red-100 text-red-800" };
  if (v === "payment_initiated") return { text: "Pago iniciado", cls: "bg-blue-100 text-blue-800" };
  if (v === "pending_payment") return { text: "Pendiente", cls: "bg-gray-100 text-gray-800" };
  return { text: s || "—", cls: "bg-gray-100 text-gray-800" };
}

export default function PurchasesPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const highlightOrder = useMemo(() => sp.get("order") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [downloading, setDownloading] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/orders/my", { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudieron cargar tus compras.");
      setItems(json?.items || []);
    } catch (e) {
      setErr(e?.message || "Error cargando compras.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function download(orderId) {
    setDownloading(orderId);
    setErr("");
    try {
      const res = await fetch(`/api/orders/download?orderId=${encodeURIComponent(orderId)}`, {
        method: "GET",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error || "No se pudo descargar.");

      if (!json?.downloadUrl) throw new Error("No vino downloadUrl.");

      window.location.href = json.downloadUrl;
    } catch (e) {
      setErr(e?.message || "Error descargando.");
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900">Mis compras</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
        >
          Volver al dashboard
        </button>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border bg-white p-4 text-red-600">{err}</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="rounded-2xl border bg-white p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2" />
              <div className="mt-4 h-4 bg-gray-200 rounded w-2/3" />
              <div className="mt-2 h-4 bg-gray-200 rounded w-1/3" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6">
              <p className="text-gray-700">Aún no tienes compras.</p>
            </div>
          ) : (
            items.map((it) => {
              const st = statusLabel(it.status);
              const isHL = highlightOrder && it.id === highlightOrder;

              return (
                <div
                  key={it.id}
                  className={`rounded-2xl border bg-white p-5 ${
                    isHL ? "ring-2 ring-blue-400" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-extrabold text-gray-900">
                        {it.event?.title || "Evento"}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {it.event?.starts_at
                          ? new Date(it.event.starts_at).toLocaleString("es-CL", {
                              weekday: "short",
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Fecha por confirmar"}
                      </div>

                      <div className="text-sm text-gray-600 mt-1">
                        {it.ticket?.sector ? `Sector: ${it.ticket.sector}` : ""}
                        {it.ticket?.row ? ` · Fila: ${it.ticket.row}` : ""}
                        {it.ticket?.seat ? ` · Asiento: ${it.ticket.seat}` : ""}
                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        Orden: <span className="font-mono">{it.id}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${st.cls}`}>
                        {st.text}
                      </span>

                      <div className="mt-3 font-extrabold text-gray-900">
                        {formatCLP(it.total_paid_clp ?? it.amount_clp)}
                      </div>

                      <div className="mt-3">
                        <button
                          onClick={() => download(it.id)}
                          disabled={downloading === it.id || it.status !== "held"}
                          className="rounded-xl bg-green-600 text-white px-4 py-2 font-bold hover:bg-green-700 disabled:opacity-50"
                          title={it.status !== "held" ? "Disponible sólo cuando el pago está aprobado" : ""}
                        >
                          {downloading === it.id ? "Descargando..." : "Descargar PDF"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {it.status !== "held" ? (
                    <div className="mt-4 text-sm text-gray-700 rounded-xl bg-gray-50 p-3">
                      El PDF se libera automáticamente cuando el pago quede <b>aprobado</b>.
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border bg-white p-5">
            <h3 className="font-bold text-gray-900">Tip rápido</h3>
            <p className="mt-2 text-sm text-gray-700">
              Si tu pago quedó “Pendiente / revisión”, espera la confirmación del proveedor.
              Si queda “Rechazado”, el ticket vuelve a estar disponible automáticamente.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <h3 className="font-bold text-gray-900">Soporte</h3>
            <p className="mt-2 text-sm text-gray-700">
              ¿Problemas con tu compra? Abre un ticket en Centro de ayuda para que lo resolvamos.
            </p>
            <button
              onClick={() => router.push("/support")}
              className="mt-4 rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
            >
              Ir a soporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
