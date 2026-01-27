"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardSidebar from "../../components/DashboardSidebar";

function formatCLP(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PublicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    async function fetchTicket() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tickets/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar publicación");
        setTicket(data.ticket);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchTicket();
  }, [id]);

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

  return (
    <div className="flex min-h-screen bg-[#f4f7ff]">
      <DashboardSidebar />
      <main className="flex-1 tix-container py-10">
        <button
          className="mb-6 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
          onClick={() => router.push("/dashboard/publicaciones")}
        >
          ← Volver al panel
        </button>
        <div className="tix-card p-6">
          {loading ? (
            <div className="text-center text-slate-500">Cargando publicación...</div>
          ) : error ? (
            <div className="text-center text-rose-600">{error}</div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
                {ticket?.event?.title || "Evento"}
              </h1>
              <div className="text-slate-600 mb-4">
                {ticket?.event?.venue} — {ticket?.event?.city} <br />
                <span className="text-xs">{formatDateShort(ticket?.event?.starts_at)}</span>
              </div>
              <div className="mb-4">
                <span className="font-bold">Asiento:</span> {ticket?.section_label} / {ticket?.row_label} / {ticket?.seat_label}
                {ticket?.is_named && (
                  <span className="ml-2 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">Nominada</span>
                )}
              </div>
              <div className="mb-4">
                <span className="font-bold">Precio:</span> {formatCLP(ticket?.price)}
              </div>
              <div className="mb-4">
                <span className="font-bold">Estado:</span> <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">{ticket?.status}</span>
                {ticket?.status === "paused" && (
                  <span className="ml-2 text-amber-700 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold">Tu entrada no está visible en el evento</span>
                )}
              </div>
              {actionError && (
                <div className="mb-4 text-rose-600 font-semibold">{actionError}</div>
              )}
              <div className="flex gap-2 mt-6">
                <button
                  className="tix-btn-primary"
                  onClick={handleEdit}
                  disabled={actionLoading}
                >
                  Editar
                </button>
                <button
                  className="tix-btn-ghost"
                  onClick={handlePauseReactivate}
                  disabled={actionLoading}
                >
                  {ticket?.status === "paused" ? "Reactivar" : "Pausar"}
                </button>
                <button
                  className="tix-btn-danger"
                  onClick={handleDelete}
                  disabled={actionLoading}
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
