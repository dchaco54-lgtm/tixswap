
"use client";


import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MisPublicaciones() {
  // Estado para sección vendidas y pagos
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [walletConfigured, setWalletConfigured] = useState(true); // Simulación, reemplazar por lógica real

  // Cargar ventas (últimos 90 días)
  async function loadSales() {
    setSalesLoading(true);
    try {
      const res = await fetch("/api/orders/my-sales");
      const data = await res.json();
      setSales(data.recentSales || []);
      // Simulación wallet: si falta, mostrar banner
      setWalletConfigured(false); // Cambia según lógica real
    } catch (err) {
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  }

/* =========================
   Helpers
========================= */
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

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold";
  
  if (s === "active") {
    return `${base} bg-blue-50 text-blue-700`;
  }
  if (s === "paused") {
    return `${base} bg-amber-50 text-amber-800`;
  }
  if (s === "sold") {
    return `${base} bg-emerald-50 text-emerald-700`;
  }
  if (s === "cancelled") {
    return `${base} bg-rose-50 text-rose-700`;
  }

  return `${base} bg-slate-100 text-slate-600`;
}

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    active: "Activa",
    paused: "Pausada",
    sold: "Vendida",
    cancelled: "Cancelada",
  };
  return map[s] || s || "—";
}

function safeText(v, fallback = "—") {
  const t = String(v ?? "").trim();
  return t ? t : fallback;
}

/* =========================
   Main Component
========================= */
export default function MisPublicaciones() {
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, paused: 0, sold: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, paused, sold

  // Modal edición
  const [editingListing, setEditingListing] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // Analytics colapsado
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No hay sesión");

      const res = await fetch("/api/tickets/my-listings", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al cargar publicaciones");
      }

      const data = await res.json();
      setListings(data.tickets || []);
      setSummary(data.summary || { total: 0, active: 0, paused: 0, sold: 0 });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(listing) {
    setEditingListing(listing);
    setEditPrice(String(listing.price || ""));
    setEditStatus(listing.status || "active");
    setEditError(null);
    setEditSuccess(false);
  }

  function closeEditModal() {
    setEditingListing(null);
    setEditPrice("");
    setEditStatus("active");
    setEditError(null);
    setEditSuccess(false);
  }

  async function handleSaveEdit() {
    if (!editingListing) return;

    const price = Number(editPrice);
    if (!price || price <= 0) {
      setEditError("El precio debe ser mayor a 0");
      return;
    }

    setEditLoading(true);
    setEditError(null);
    setEditSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No hay sesión");

      const res = await fetch("/api/tickets/listing", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ticket_id: editingListing.id,
          price,
          status: editStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al actualizar");
      }

      setEditSuccess(true);
      setTimeout(() => {
        closeEditModal();
        loadListings();
      }, 1000);
    } catch (err) {
      console.error(err);
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(listing) {
    if (!confirm(`¿Eliminar publicación "${listing.event?.title || 'sin título'}"?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No hay sesión");

      const res = await fetch("/api/tickets/listing", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticket_id: listing.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al eliminar");
      }

      alert("Publicación eliminada");
      loadListings();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // Aplicar filtros
  const filteredListings = listings.filter((l) => {
    // Filtro de búsqueda
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const eventTitle = (l.event?.title || "").toLowerCase();
      const venue = (l.event?.venue || "").toLowerCase();
      const city = (l.event?.city || "").toLowerCase();
      if (!eventTitle.includes(q) && !venue.includes(q) && !city.includes(q)) {
        return false;
      }
    }

    // Filtro de estado
    if (statusFilter !== "all") {
      if (l.status !== statusFilter) return false;
    }

    return true;
  });

  return (
    <>
      <div className="tix-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Mis publicaciones</h1>
            <p className="text-slate-600 mt-1">Administra tus entradas publicadas (ver, editar, pausar, eliminar).</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/sell" className="tix-btn-primary">Publicar nueva entrada</a>
            <button onClick={loadListings} className="tix-btn-ghost">Recargar</button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold">{error}</div>
        )}

        {/* Empty state */}
        {!loading && filteredListings.length === 0 && !searchQuery && statusFilter === "all" && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Aún no tienes publicaciones</h3>
            <p className="text-slate-600 mt-2 max-w-md mx-auto">Publica tu primera entrada y acá podrás editarla, pausarla o eliminarla.</p>
            <a href="/sell" className="inline-block mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-extrabold rounded-full hover:shadow-lg transition-all">Publicar mi primera entrada</a>
            <a href="/events" className="block mt-2 text-blue-600 underline">Ver eventos</a>
          </div>
        )}

        {/* Tabla publicaciones */}
        {(filteredListings.length > 0 || searchQuery || statusFilter !== "all") && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Barra superior de filtros y orden */}
            <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">Mis publicaciones</div>
                <div className="text-sm text-slate-600 mt-1">{filteredListings.length} entrada(s) encontrada(s)</div>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <input type="text" placeholder="Buscar por evento, lugar, ciudad…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">Todos</option>
                  <option value="active">Activas</option>
                  <option value="paused">Pausadas</option>
                  <option value="sold">Vendidas</option>
                  <option value="review">En revisión</option>
                </select>
                {/* Orden simple */}
                <select className="px-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="recent">Más recientes</option>
                  <option value="event">Próximo a ocurrir</option>
                  <option value="price">Mayor precio</option>
                </select>
              </div>
            </div>
            {/* ...existing table code... */}
          </div>
        )}

        {/* Sección colapsable Vendidas y pagos */}
        <div className="mt-8">
          <button onClick={() => { setShowSales(!showSales); if (!sales.length) loadSales(); }} className="w-full text-left px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between">
            <span>{showSales ? "Ocultar" : "Ver"} vendidas y pagos</span>
            <svg className={`w-5 h-5 transition-transform ${showSales ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showSales && (
            <div className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl">
              {!walletConfigured && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-semibold">
                  Te falta configurar tu Wallet para poder pagarte. <a href="/dashboard?tab=wallet" className="underline text-blue-600">Configurar ahora</a>
                </div>
              )}
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr className="text-xs font-extrabold text-slate-600">
                    <th className="px-5 py-3">Fecha venta</th>
                    <th className="px-5 py-3">Evento</th>
                    <th className="px-5 py-3">Comprador</th>
                    <th className="px-5 py-3">Monto venta</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Pago estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesLoading ? (
                    <tr><td colSpan={6} className="px-5 py-4 text-slate-600">Cargando ventas…</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-6 text-slate-600 text-center">No tienes ventas en los últimos 90 días.</td></tr>
                  ) : (
                    sales.map((sale) => {
                      // Calcular pago estimado: 48–72h post evento, saltando fin de semana
                      const eventDate = new Date(sale.ticket?.event?.starts_at);
                      let minDate = new Date(eventDate);
                      let maxDate = new Date(eventDate);
                      minDate.setDate(minDate.getDate() + 2);
                      maxDate.setDate(maxDate.getDate() + 3);
                      // Si cae sábado, pasa a lunes
                      if (minDate.getDay() === 6) minDate.setDate(minDate.getDate() + 2);
                      if (minDate.getDay() === 0) minDate.setDate(minDate.getDate() + 1);
                      if (maxDate.getDay() === 6) maxDate.setDate(maxDate.getDate() + 2);
                      if (maxDate.getDay() === 0) maxDate.setDate(maxDate.getDate() + 1);
                      const pagoEstimado = `${formatDateShort(minDate)} a ${formatDateShort(maxDate)}`;
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatDateShort(sale.paid_at || sale.created_at)}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-extrabold text-slate-900">{sale.ticket?.event?.title || "—"}</div>
                            <div className="text-xs text-slate-500 mt-1">{sale.ticket?.event?.venue || "—"} {sale.ticket?.event?.city ? `· ${sale.ticket.event.city}` : ""}</div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">{sale.buyer?.full_name || sale.buyer?.email || "—"}</td>
                          <td className="px-5 py-4"><div className="text-sm font-extrabold text-slate-900">{formatCLP(sale.total_paid_clp ?? sale.total_clp)}</div></td>
                          <td className="px-5 py-4">{statusBadgeClass(sale.status)}</td>
                          <td className="px-5 py-4 text-xs text-slate-700">{pagoEstimado}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ...existing code for modal edición... */}
      </div>

      {/* Modal de edición */}
      {editingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-slate-900">
                Editar publicación
              </h3>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-900">
                {editingListing.event?.title || "Sin título"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {editingListing.event?.venue || "—"} · {formatDateTime(editingListing.event?.event_datetime)}
              </div>
            </div>

            {editError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm font-semibold">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm font-semibold">
                ✅ Cambios guardados
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Precio
                </label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  disabled={editLoading || editSuccess}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Estado
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={editLoading || editSuccess || editingListing.status === "sold"}
                >
                  <option value="active">Activa</option>
                  <option value="paused">Pausada</option>
                  {editingListing.status === "sold" && <option value="sold">Vendida</option>}
                </select>
                {editingListing.status === "sold" && (
                  <div className="mt-2 text-xs text-slate-500">
                    No puedes cambiar el estado de una entrada vendida
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                disabled={editLoading || editSuccess}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-extrabold rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editLoading ? "Guardando..." : editSuccess ? "¡Guardado!" : "Guardar cambios"}
              </button>

              <button
                onClick={closeEditModal}
                disabled={editLoading}
                className="px-4 py-3 bg-slate-100 text-slate-700 font-extrabold rounded-full hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
