"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import DashboardSidebar from "../../components/DashboardSidebar";
import OrderChat from "@/app/components/OrderChat";
import { createClient } from "@/lib/supabase/client";

function formatCLP(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateLong(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s === "active") return { text: "Activa", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (s === "paused") return { text: "Pausada", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (s === "sold") return { text: "Vendida", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  if (s === "locked") return { text: "Bloqueada", cls: "bg-red-50 text-red-700 border-red-200" };
  if (s === "processing") return { text: "Procesando", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return { text: status || "Estado", cls: "bg-slate-50 text-slate-700 border-slate-200" };
}

export default function PublicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [order, setOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [renominatedUploading, setRenominatedUploading] = useState(false);
  const [renominatedMsg, setRenominatedMsg] = useState("");
  const fileInputRef = useRef(null);
  const supabaseRef = useRef(null);
  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  };

  useEffect(() => {
    async function fetchTicket() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tickets/my-publications?ts=${Date.now()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Error al cargar publicación");
        const found = (data?.tickets || []).find((t) => String(t.id) === String(id)) || null;
        if (!found) throw new Error("Publicación no encontrada");
        setTicket(found);
      } catch (err) {
        setError(err.message);
        setTicket(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchTicket();
  }, [id]);

  useEffect(() => {
    async function fetchOrder() {
      setOrder(null);
      if (!ticket || String(ticket.status || "").toLowerCase() !== "sold") return;

      try {
        const res = await fetch(`/api/orders/by-ticket/${id}?ts=${Date.now()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Error cargando venta");
        setOrder(data?.order || null);
      } catch {
        // no bloquea el detalle del ticket si falla el fetch de orden
        setOrder(null);
      }
    }

    if (id && ticket) fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ticket?.status]);

  function handleEdit() {
    router.push(`/sell/confirm?editTicketId=${id}&returnTo=/dashboard/publicaciones`);
  }

  async function handlePauseReactivate() {
    if (!ticket) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const newStatus = ticket.status === "paused" ? "active" : "paused";
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar estado");
      setTicket({ ...ticket, status: newStatus });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    if (["sold", "locked", "processing"].includes(ticket.status)) {
      setActionError("No se puede eliminar este ticket en su estado actual.");
      return;
    }
    if (!confirm("¿Eliminar definitivamente? Esto no se puede deshacer.")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar publicación");
      router.push("/dashboard/publicaciones");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const badge = useMemo(() => statusBadge(ticket?.status), [ticket?.status]);
  const isSold = String(ticket?.status || "").toLowerCase() === "sold";
  const canEdit = !!ticket && !["sold", "locked", "processing"].includes(ticket.status);
  const nominated = Boolean(ticket?.is_nominated);

  const pdfHref = ticket
    ? isSold && order?.id
      ? `/api/orders/${order.id}/pdf`
      : `/api/tickets/${ticket.id}/pdf`
    : "#";

  const canUploadRenominated = Boolean(isSold && nominated && order?.id && !renominatedUploading);

  const onPickRenominated = () => {
    setRenominatedMsg("");
    fileInputRef.current?.click();
  };

  const onRenominatedFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setRenominatedMsg("Debe ser un PDF.");
      return;
    }
    if (!order?.id) {
      setRenominatedMsg("No encontré la venta asociada.");
      return;
    }

    try {
      setRenominatedUploading(true);
      setRenominatedMsg("");

      const { data: sess } = await getSupabase().auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        setRenominatedMsg("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/orders/${order.id}/renominated`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || "No se pudo subir el PDF renominado.");

      setRenominatedMsg("PDF re-nominado subido ✅");
      // refrescar estado de orden (para que el comprador descargue el nuevo)
      const oRes = await fetch(`/api/orders/by-ticket/${id}?ts=${Date.now()}`, { cache: "no-store" });
      const oJson = await oRes.json().catch(() => ({}));
      if (oRes.ok) setOrder(oJson?.order || null);
    } catch (err) {
      setRenominatedMsg(err?.message || "No se pudo subir el PDF renominado.");
    } finally {
      setRenominatedUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7ff]">
      <DashboardSidebar />
      <main className="flex-1 tix-container py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard/publicaciones"
              className="text-sm text-slate-600 hover:underline"
            >
              ← Volver a Mis publicaciones
            </Link>
            <h1 className="text-2xl font-semibold mt-2">Detalle de publicación</h1>
          </div>

          {ticket ? (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badge.cls}`}
            >
              {badge.text}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm animate-pulse h-64" />
        ) : null}

        {!loading && ticket ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header Evento */}
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="relative h-52 bg-slate-100">
                  {ticket.event?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ticket.event.image_url}
                      alt={ticket.event?.title || "Evento"}
                      className="w-full h-full object-cover"
                    />
                  ) : null}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <div className="text-xl font-semibold">
                      {ticket.event?.title || "Evento"}
                    </div>
                    <div className="text-sm text-white/90">
                      {ticket.event?.city ? `${ticket.event.city} \u00b7 ` : ""}
                      {ticket.event?.venue ? `${ticket.event.venue} \u00b7 ` : ""}
                      {ticket.event?.starts_at ? formatDateLong(ticket.event.starts_at) : ""}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-slate-500">Sector</div>
                      <div className="font-semibold">{ticket.section || "-"}</div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-slate-500">Fila</div>
                      <div className="font-semibold">{ticket.row || "-"}</div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-slate-500">Asiento</div>
                      <div className="font-semibold">{ticket.seat || "-"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs bg-slate-50 text-slate-700 border-slate-200">
                      Nominada: {nominated ? "Sí" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-lg font-semibold mb-1">Acciones</div>
                <div className="text-sm text-slate-600 mb-4">
                  Administra tu publicación, descarga el PDF y habla con el comprador si está vendida.
                </div>

                {actionError ? (
                  <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {actionError}
                  </div>
                ) : null}

                {renominatedMsg ? (
                  <div className="mb-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    {renominatedMsg}
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={pdfHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Descargar PDF
                  </a>

                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    disabled={!isSold || !order?.id}
                    className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 ${
                      isSold && order?.id ? "" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Abrir chat con comprador
                  </button>

                  <Link
                    href="/support"
                    className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Soporte
                  </Link>
                </div>

                {/* Re-nominado (solo vendida + nominada) */}
                {isSold && nominated ? (
                  <div className="mt-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={onRenominatedFileChange}
                    />
                    <button
                      type="button"
                      onClick={onPickRenominated}
                      disabled={!canUploadRenominated}
                      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 ${
                        canUploadRenominated ? "" : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {renominatedUploading ? "Subiendo..." : "Subir PDF re-nominado"}
                    </button>
                  </div>
                ) : null}

                {/* Acciones del vendedor (solo si editable) */}
                {!isSold ? (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleEdit}
                      disabled={!canEdit || actionLoading}
                      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm ${
                        canEdit
                          ? "bg-white border hover:bg-slate-50"
                          : "bg-slate-200 text-slate-500 cursor-not-allowed border"
                      }`}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={handlePauseReactivate}
                      disabled={!canEdit || actionLoading}
                      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 ${
                        canEdit ? "" : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {String(ticket.status || "").toLowerCase() === "paused" ? "Reactivar" : "Pausar"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={!canEdit || actionLoading}
                      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm ${
                        canEdit
                          ? "bg-white hover:bg-red-50 text-red-600 border-red-200"
                          : "bg-slate-200 text-slate-500 cursor-not-allowed border"
                      }`}
                    >
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-lg font-semibold mb-3">Resumen</div>

                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">Precio</span>
                  <span className="font-semibold">{formatCLP(ticket.price)}</span>
                </div>

                {isSold && order ? (
                  <>
                    <div className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">Total</span>
                      <span className="font-semibold">
                        {formatCLP(order.total_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">Entrada</span>
                      <span className="font-medium">
                        {formatCLP(order.ticket_price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">Fee</span>
                      <span className="font-medium">
                        {formatCLP(order.platform_fee)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

              {isSold && order ? (
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="text-lg font-semibold mb-3">Comprador</div>
                  <div className="text-sm">
                    <div className="font-semibold">{order.buyer_name || "Comprador"}</div>
                    <div className="text-slate-600">{order.buyer_email || ""}</div>
                    <div className="text-slate-500 text-xs mt-1">
                      RUT: {order.buyer_rut || "-"}
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setChatOpen(true)}
                      disabled={!order?.id}
                      className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 ${
                        order?.id ? "" : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      Hablar por chat
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {chatOpen && order?.id ? (
          <OrderChat orderId={order.id} onClose={() => setChatOpen(false)} />
        ) : null}
      </main>
    </div>
  );
}
