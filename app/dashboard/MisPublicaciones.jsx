"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

/** =========================================================
 *  Auth token (mantengo tu lógica)
 *  ========================================================= */
async function getAccessToken() {
  // 1) Forma correcta en tu proyecto (cookies + auth-helpers)
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch {
    // seguimos con fallback
  }

  // 2) Fallback: si existe token en localStorage (legacy)
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("sb-auth-token");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
      }
    } catch {}
  }

  return null;
}

const BLOCKED_STATUSES = new Set(["sold", "locked", "processing"]);

export default function MisPublicaciones() {
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    paused: 0,
    sold: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI extras
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | paused | sold
  const [toast, setToast] = useState(null); // { type: "ok"|"err", msg: string }

  // Modal edición
  const [editOpen, setEditOpen] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [editForm, setEditForm] = useState({
    price: "",
    section: "",
    row: "",
    seat: "",
  });
  const [saving, setSaving] = useState(false);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3000);
  };

  const fetchPublications = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setTickets([]);
        setSummary({ total: 0, active: 0, paused: 0, sold: 0 });
        setError("No hay sesión válida. Cierra sesión y vuelve a entrar.");
        return;
      }

      const res = await fetch(`/api/tickets/my-publications?ts=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `API ${res.status} ${res.statusText} - ${txt || "sin detalle"}`
        );
      }

      const data = await res.json();
      const nextTickets = data.tickets || [];
      setTickets(nextTickets);
      setSummary(
        data.summary || computeSummary(nextTickets)
      );
    } catch (err) {
      console.error("MisPublicaciones error:", err);
      setError(
        typeof err?.message === "string"
          ? err.message
          : "No se pudieron cargar tus publicaciones."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, []);

  /** =========================================================
   *  Helpers
   *  ========================================================= */
  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (tickets || [])
      .filter((t) => {
        if (filter === "all") return true;
        return (t.status || "").toLowerCase() === filter;
      })
      .filter((t) => {
        if (!q) return true;
        const title = (t.event?.title || "").toLowerCase();
        const venue = (t.event?.venue || "").toLowerCase();
        const city = (t.event?.city || "").toLowerCase();
        const section = (t.section || "").toLowerCase();
        const row = (t.row || "").toLowerCase();
        const seat = (t.seat || "").toLowerCase();
        return (
          title.includes(q) ||
          venue.includes(q) ||
          city.includes(q) ||
          section.includes(q) ||
          row.includes(q) ||
          seat.includes(q)
        );
      });
  }, [tickets, query, filter]);

  const isBlocked = (t) => BLOCKED_STATUSES.has(t?.status);

  const fmtCLP = (n) => {
    const val = Number(n || 0);
    return `$${val.toLocaleString("es-CL")}`;
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  };

  const computeSummary = (list) => {
    const summary = { total: list.length, active: 0, paused: 0, sold: 0 };
    for (const t of list) {
      const status = (t?.status || "").toLowerCase();
      if (status === "active") summary.active += 1;
      else if (status === "paused") summary.paused += 1;
      else if (status === "sold") summary.sold += 1;
    }
    return summary;
  };

  /** =========================================================
   *  Acciones (PATCH/DELETE a /api/tickets/[id])
   *  OJO: este endpoint usa cookies, así que no necesitas bearer.
   *  ========================================================= */
  const apiPatchTicket = async (id, payload) => {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `PATCH ${res.status}`);
    }
    return true;
  };

  const apiDeleteTicket = async (id) => {
    const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `DELETE ${res.status}`);
    }
    return true;
  };

  const onTogglePause = async (t) => {
    try {
      if (isBlocked(t)) return;

      const nextStatus = t.status === "paused" ? "active" : "paused";
      await apiPatchTicket(t.id, { status: nextStatus });

      showToast("ok", nextStatus === "paused" ? "Publicación pausada." : "Publicación reanudada.");
      fetchPublications();
    } catch (e) {
      console.error(e);
      showToast("err", e?.message || "No se pudo actualizar el estado.");
    }
  };

  const onDelete = async (t) => {
    try {
      if (isBlocked(t)) return;

      const ok = window.confirm(
        "¿Seguro que quieres eliminar esta publicación? Esto no se puede deshacer."
      );
      if (!ok) return;

      await apiDeleteTicket(t.id);
      showToast("ok", "Publicación eliminada.");
      fetchPublications();
    } catch (e) {
      console.error(e);
      showToast("err", e?.message || "No se pudo eliminar.");
    }
  };

  const onOpenEdit = (t) => {
    if (isBlocked(t)) return;

    setEditTicket(t);
    setEditForm({
      price: String(t.price ?? ""),
      section: String(t.section ?? ""),
      row: String(t.row ?? ""),
      seat: String(t.seat ?? ""),
    });
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editTicket) return;

    try {
      setSaving(true);

      const priceNum = Number(
        String(editForm.price || "").replace(/[^\d]/g, "")
      );

      // Mapeo a los nombres que tu /api/tickets/[id] espera:
      // section_label, row_label, seat_label, price
      const payload = {
        price: priceNum,
        section_label: editForm.section?.trim() || null,
        row_label: editForm.row?.trim() || null,
        seat_label: editForm.seat?.trim() || null,
      };

      // Limpieza (si quedan null, el endpoint igual los ignora si no los seteas;
      // pero lo dejamos explícito sin romper nada)
      Object.keys(payload).forEach((k) => {
        if (payload[k] === null || payload[k] === "") delete payload[k];
      });

      await apiPatchTicket(editTicket.id, payload);

      showToast("ok", "Publicación actualizada ✅");
      setEditOpen(false);
      setEditTicket(null);
      fetchPublications();
    } catch (e) {
      console.error(e);
      showToast("err", e?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  /** =========================================================
   *  Render states
   *  ========================================================= */
  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-56 bg-gray-200 rounded mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="h-20 bg-gray-200 rounded-xl" />
              <div className="h-20 bg-gray-200 rounded-xl" />
              <div className="h-20 bg-gray-200 rounded-xl" />
              <div className="h-20 bg-gray-200 rounded-xl" />
            </div>
            <div className="h-12 bg-gray-200 rounded-xl mb-4" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
            <div className="text-lg font-semibold text-gray-900 mb-2">
              No se pudieron cargar tus publicaciones
            </div>

            <div className="text-xs text-red-500 break-words mt-2">{error}</div>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={fetchPublications}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Reintentar
              </button>
              <a
                href="/logout"
                className="px-4 py-2 rounded-xl border hover:bg-gray-50 text-gray-700 transition"
              >
                Cerrar sesión
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** =========================================================
   *  Main UI
   *  ========================================================= */
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm border shadow-sm ${
              toast.type === "ok"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Mis publicaciones
            </h1>
            <p className="text-sm text-gray-500">
              Administra tus entradas: editar, pausar o eliminar (vendidas quedan bloqueadas).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPublications}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 transition text-sm"
            >
              Recargar
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Activas" value={summary.active} />
          <SummaryCard label="Pausadas" value={summary.paused} />
          <SummaryCard label="Vendidas" value={summary.sold} />
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por evento, lugar, ciudad o asiento..."
                className="w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border bg-white text-sm"
              >
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="paused">Pausadas</option>
                <option value="sold">Vendidas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards (estilo Mis compras) */}
        {filteredTickets.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-gray-500 shadow-sm">
            No tienes publicaciones para mostrar.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTickets.map((t) => {
              const blocked = isBlocked(t);
              const nominated = Boolean(t.is_nominated);
              const blockedMsg =
                t.status === "sold"
                  ? "Vendida: edición bloqueada"
                  : t.status === "locked"
                  ? "Bloqueada: no editable"
                  : t.status === "processing"
                  ? "En proceso: no editable"
                  : null;

              const eventLine = [
                t.event?.city || null,
                t.event?.venue || null,
                t.event?.starts_at ? fmtDate(t.event.starts_at) : null,
              ]
                .filter(Boolean)
                .join(" \u00b7 ");

              const seatLine = [
                t.section ? `Sector ${t.section}` : null,
                t.row ? `Fila ${t.row}` : null,
                t.seat ? `Asiento ${t.seat}` : null,
              ]
                .filter(Boolean)
                .join(" \u2022 ");

              return (
                <div key={t.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                      {t.event?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.event.image_url}
                          alt={t.event?.title || "Evento"}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-semibold truncate">
                            {t.event?.title || "Publicación"}
                          </div>

                          <div className="text-sm text-slate-600">
                            {eventLine || "\u2014"}
                          </div>

                          <div className="text-sm text-slate-600 mt-1">
                            {seatLine || "Sector \u2022 Fila \u2022 Asiento"}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <StatusBadge status={t.status} />
                            <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs bg-slate-50 text-slate-700 border-slate-200">
                              Nominada: {nominated ? "Sí" : "No"}
                            </span>
                            {blockedMsg ? (
                              <span className="text-xs text-slate-500">{blockedMsg}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xl font-semibold text-slate-900">
                            {fmtCLP(t.price)}
                          </div>
                          <Link
                            href={`/dashboard/publications/${t.id}`}
                            className="inline-flex items-center justify-center mt-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                          >
                            Ver más →
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
                        <button
                          onClick={() => onOpenEdit(t)}
                          disabled={blocked}
                          className={`px-3 py-2 rounded-xl text-sm border transition ${
                            blocked
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white hover:bg-gray-50 text-gray-700"
                          }`}
                          title={blocked ? blockedMsg || "Bloqueado" : "Editar"}
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => onTogglePause(t)}
                          disabled={blocked}
                          className={`px-3 py-2 rounded-xl text-sm border transition ${
                            blocked
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white hover:bg-gray-50 text-gray-700"
                          }`}
                          title={
                            blocked
                              ? blockedMsg || "Bloqueado"
                              : t.status === "paused"
                              ? "Reanudar"
                              : "Pausar"
                          }
                        >
                          {t.status === "paused" ? "Reanudar" : "Pausar"}
                        </button>

                        <button
                          onClick={() => onDelete(t)}
                          disabled={blocked}
                          className={`px-3 py-2 rounded-xl text-sm border transition ${
                            blocked
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white hover:bg-red-50 text-red-600 border-red-200"
                          }`}
                          title={blocked ? blockedMsg || "Bloqueado" : "Eliminar"}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal editar */}
        {editOpen && (
          <Modal
            title="Editar publicación"
            onClose={() => {
              if (saving) return;
              setEditOpen(false);
              setEditTicket(null);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Precio (CLP)">
                <input
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, price: e.target.value }))
                  }
                  placeholder="Ej: 2100"
                  className="w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>

              <Field label="Sección">
                <input
                  value={editForm.section}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, section: e.target.value }))
                  }
                  placeholder="Ej: Cancha, Platea, etc."
                  className="w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>

              <Field label="Fila">
                <input
                  value={editForm.row}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, row: e.target.value }))
                  }
                  placeholder="Ej: A"
                  className="w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>

              <Field label="Asiento">
                <input
                  value={editForm.seat}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, seat: e.target.value }))
                  }
                  placeholder="Ej: 1"
                  className="w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  if (saving) return;
                  setEditOpen(false);
                  setEditTicket(null);
                }}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 transition"
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                onClick={onSaveEdit}
                className={`px-4 py-2 rounded-xl text-white transition ${
                  saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

/* ===================== */
/* ====== UI bits ====== */
/* ===================== */

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { label: "Activa", className: "bg-green-50 text-green-700 border-green-200" },
    paused: { label: "Pausada", className: "bg-yellow-50 text-yellow-800 border-yellow-200" },
    sold: { label: "Vendida", className: "bg-gray-100 text-gray-700 border-gray-200" },
    locked: { label: "Bloqueada", className: "bg-red-50 text-red-700 border-red-200" },
    processing: { label: "Procesando", className: "bg-blue-50 text-blue-700 border-blue-200" },
  };

  const cfg = map[status] || {
    label: status || "-",
    className: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl rounded-2xl border bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="font-semibold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border bg-white hover:bg-gray-50 text-sm"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
