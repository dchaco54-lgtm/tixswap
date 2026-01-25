"use client";

// Helper para sumar días hábiles (excluye sábado/domingo)
function addBusinessDays(date, n) {
  let d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Helpers deben ir antes del export default
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
  if (s === "active") return `${base} bg-blue-50 text-blue-700`;
  if (s === "paused") return `${base} bg-amber-50 text-amber-800`;
  if (s === "sold") return `${base} bg-emerald-50 text-emerald-700`;
  if (s === "cancelled") return `${base} bg-rose-50 text-rose-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  const map = { active: "Activa", paused: "Pausada", sold: "Vendida", cancelled: "Cancelada" };
  return map[s] || s || "—";
}

function safeText(v, fallback = "—") {
  const t = String(v ?? "").trim();
  return t ? t : fallback;
}

export default function MisPublicaciones() {
    // Estado para publicaciones
    const [listings, setListings] = useState([]);
    const [summary, setSummary] = useState({ total: 0, active: 0, paused: 0, sold: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filtros
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("recent");

    // Modal edición
    const [editingListing, setEditingListing] = useState(null);
    const [editPrice, setEditPrice] = useState("");
    const [editStatus, setEditStatus] = useState("active");
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);
    const [editSuccess, setEditSuccess] = useState(false);

    useEffect(() => {
      loadListings();
      // Polling cada 5 segundos para mantener publicaciones actualizadas
      const interval = setInterval(() => {
        loadListings();
      }, 5000);
      return () => clearInterval(interval);
    }, []);

      async function loadListings() {
        setLoading(true);
        setError(null);
        try {
          // Obtener el token del usuario autenticado desde Supabase
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const res = await fetch("/api/tickets/my-publications", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "No pudimos cargar tus entradas. Reintentar.");
          }
          const data = await res.json();
          setListings(data.tickets || []);
          setSummary({ total: (data.tickets || []).length });
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
  // Estado para sección vendidas y pagos
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [walletConfigured, setWalletConfigured] = useState(true); // Real: depende de datos bancarios

  // Cargar ventas (últimos 90 días)
  async function loadSales() {
    setSalesLoading(true);
    try {
      const res = await fetch("/api/orders/my-sales");
      const data = await res.json();
      setSales(data.recentSales || []);
      // Lógica real: simular que wallet está configurada si existen datos bancarios en localStorage o en profile (ajustar a tu backend real)
      // Aquí solo ejemplo: si tienes datos en localStorage.profile_wallet_configured === 'true'
      const profile = JSON.parse(localStorage.getItem('profile') || '{}');
      const hasWallet = !!(profile.bank && profile.account && profile.rut && profile.name);
      setWalletConfigured(hasWallet);
    } catch (err) {
      setSales([]);
    } finally {
      setSalesLoading(false);
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
          ticketId: editingListing.id, // Cambiado a ticketId
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
        body: JSON.stringify({ ticketId: listing.id }), // Cambiado a ticketId
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
// Helpers para comisión y payout
function calcFee(price) {
  return Math.max(Math.round(price * 0.025), 1200);
}
function calcPayout(price) {
  return Math.max(0, price - calcFee(price));
}

  // Aplicar filtros y orden
  let filteredListings = listings.filter((l) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const eventTitle = (l.event?.title || "").toLowerCase();
      const venue = (l.event?.venue || "").toLowerCase();
      const city = (l.event?.city || "").toLowerCase();
      if (!eventTitle.includes(q) && !venue.includes(q) && !city.includes(q)) {
        return false;
      }
    }
    if (statusFilter !== "all") {
      if (l.status !== statusFilter) return false;
    }
    return true;
  });
  if (sortOrder === "price") {
    filteredListings = filteredListings.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (sortOrder === "event") {
    filteredListings = filteredListings.slice().sort((a, b) => {
      const da = new Date(a.event?.starts_at || 0);
      const db = new Date(b.event?.starts_at || 0);
      return da - db;
    });
  } else {
    filteredListings = filteredListings.slice().sort((a, b) => {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return db - da;
    });
  }

  return (
    <>
      <div className="tix-card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-0 z-10 bg-white pb-2 mb-2">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Mis publicaciones</h1>
            <p className="text-slate-600 mt-1">Administra tus entradas: ver, editar, pausar o eliminar.</p>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <a href="/sell" className="tix-btn">Publicar nueva entrada</a>
            <button onClick={loadListings} className="tix-btn-ghost">Recargar</button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold">{error}</div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
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
        {(filteredListings.length > 0 || searchQuery || statusFilter !== "all") && !loading && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Barra superior de filtros y orden */}
            <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-0 z-10 bg-white border-b border-slate-100">
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
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="recent">Más recientes</option>
                  <option value="event">Próximo a ocurrir</option>
                  <option value="price">Mayor precio</option>
                </select>
              </div>
            </div>
            {/* Tabla de publicaciones */}
            <div className="overflow-x-auto">
              <div className="text-xs text-slate-500 mb-2 text-center md:hidden">← Desliza para ver más →</div>
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr className="text-xs font-extrabold text-slate-600">
                    <th className="px-5 py-3">Fecha pub.</th>
                    <th className="px-5 py-3">Evento</th>
                    <th className="px-5 py-3">Fecha evento</th>
                    <th className="px-5 py-3">Lugar</th>
                    <th className="px-5 py-3">Precio</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredListings.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-slate-600 text-center" colSpan={7}>No se encontraron publicaciones con los filtros aplicados.</td>
                    </tr>
                  ) : (
                    filteredListings.map((listing) => {
                      const eventTitle = listing.event?.title || "—";
                      const eventDate = listing.event?.starts_at || "—";
                      const venue = listing.event?.venue || "—";
                      const city = listing.event?.city || "";
                      const row = listing.row || "";
                      const seat = listing.seat || "";
                      return (
                        <tr key={listing.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatDateShort(listing.created_at)}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-extrabold text-slate-900">{eventTitle}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {listing.section || ""}
                              {row && ` · Fila ${row}`}
                              {seat && ` · Asiento ${seat}`}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">{formatDateTime(eventDate)}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm text-slate-800">{safeText(venue, "—")}</div>
                            {city && (<div className="text-xs text-slate-500 mt-1">{city}</div>)}
                          </td>
                          <td className="px-5 py-4"><div className="text-sm font-extrabold text-slate-900">{formatCLP(listing.price)}</div></td>
                          <td className="px-5 py-4"><span className={statusBadgeClass(listing.status)}>{statusLabel(listing.status)}</span></td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditModal(listing)} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-extrabold rounded-full hover:bg-blue-100 transition-colors" disabled={listing.status === "sold"}>Editar</button>
                              {listing.status === "active" && (<button onClick={() => { openEditModal(listing); setEditStatus("paused"); }} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 font-extrabold rounded-full hover:bg-amber-100 transition-colors">Pausar</button>)}
                              {listing.status === "paused" && (<button onClick={() => { openEditModal(listing); setEditStatus("active"); }} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-extrabold rounded-full hover:bg-blue-100 transition-colors">Activar</button>)}
                              {listing.status !== "sold" && (<button onClick={() => handleDelete(listing)} className="text-xs px-3 py-1.5 bg-rose-50 text-rose-700 font-extrabold rounded-full hover:bg-rose-100 transition-colors">Eliminar</button>)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
                  Te falta configurar tu Wallet para poder pagarte. <a href="/dashboard/wallet" className="underline text-blue-600">Configurar ahora</a>
                </div>
              )}
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr className="text-xs font-extrabold text-slate-600">
                    <th className="px-5 py-3">Fecha venta</th>
                    <th className="px-5 py-3">Evento</th>
                    <th className="px-5 py-3">Comprador</th>
                    <th className="px-5 py-3">Monto venta</th>
                    <th className="px-5 py-3">Estado pago</th>
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
                      // Calcular pago estimado: 48–72h hábiles post evento
                      const eventDate = sale.ticket?.event?.starts_at ? new Date(sale.ticket.event.starts_at) : null;
                      let minDate = eventDate ? addBusinessDays(eventDate, 2) : null;
                      let maxDate = eventDate ? addBusinessDays(eventDate, 3) : null;
                      const pagoEstimado = (minDate && maxDate)
                        ? `${formatDateShort(minDate)} a ${formatDateShort(maxDate)}`
                        : "—";
                      // Estado pago
                      let estadoPago = "En custodia";
                      if (!walletConfigured) estadoPago = "Pendiente de wallet";
                      else if (sale.payment_state === "released") estadoPago = "Pagado";
                      else if (sale.payment_state === "releasing") estadoPago = "Liberación en curso";
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatDateShort(sale.paid_at || sale.created_at)}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-extrabold text-slate-900">{sale.ticket?.event?.title || "—"}</div>
                            <div className="text-xs text-slate-500 mt-1">{sale.ticket?.event?.venue || "—"} {sale.ticket?.event?.city ? `· ${sale.ticket.event.city}` : ""}</div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">{sale.buyer?.full_name || sale.buyer?.email || "—"}</td>
                          <td className="px-5 py-4"><div className="text-sm font-extrabold text-slate-900">{formatCLP(sale.total_paid_clp ?? sale.total_clp)}</div></td>
                          <td className="px-5 py-4 text-xs text-slate-700">{estadoPago}</td>
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
                {editingListing.event?.venue || "—"} · {formatDateTime(editingListing.event?.starts_at)}
              </div>
            </div>
              {/* Resumen de comisión y payout */}
              <div className="mt-2 text-xs text-slate-700 bg-slate-50 rounded-xl p-3">
                <div><b>Precio:</b> {formatCLP(Number(editPrice) || 0)}</div>
                <div><b>Comisión (2.5% mín $1.200):</b> {formatCLP(calcFee(Number(editPrice) || 0))}</div>
                <div><b>Tú recibes aprox.:</b> {formatCLP(calcPayout(Number(editPrice) || 0))}</div>
                {calcPayout(Number(editPrice) || 0) === 0 && (
                  <div className="mt-2 text-rose-600 font-bold">El fee es igual o mayor al precio. No recibirás pago.</div>
                )}
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
