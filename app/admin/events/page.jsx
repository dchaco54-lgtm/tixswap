// app/admin/events/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** =========================
 * Helpers
 * ========================= */
function norm(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // fallback
  return d.toISOString();
}

function formatEventDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(iso);
  }
}

/** =========================
 * Page
 * ========================= */
export default function AdminEventsPage() {
  const router = useRouter();

  // Guard / perms
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Data
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");

  // Create event form
  const [newEvent, setNewEvent] = useState({
    title: "",
    starts_at: "",
    venue: "",
    city: "",
    category: "",
    image_url: "",
  });

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    id: "",
    title: "",
    starts_at: "",
    venue: "",
    city: "",
    category: "",
    image_url: "",
  });

  const [loading, setLoading] = useState(false);

  /** =========================
   * Admin guard (ZIP-compatible):
   * - must be logged in
   * - must have profiles.role === 'admin'
   * ========================= */
  useEffect(() => {
    const guard = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;

        if (!user) {
          router.replace(`/login?redirectTo=${encodeURIComponent("/admin/events")}`);
          return;
        }

        // ✅ Tu proyecto valida admin por profiles.role
        const { data: profileRow, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileErr) {
          console.warn("[admin/events] no se pudo leer profiles.role:", profileErr);
          router.replace("/dashboard");
          return;
        }

        if (profileRow?.role !== "admin") {
          router.replace("/dashboard");
          return;
        }

        setIsAdmin(true);
        setCheckingAdmin(false);
        await fetchEvents();
      } catch (e) {
        console.error("[admin/events] guard error:", e);
        router.replace("/dashboard");
      }
    };

    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** =========================
   * Fetch events
   * ========================= */
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[admin/events] fetchEvents error:", error);
      setEvents([]);
      return;
    }

    setEvents(Array.isArray(data) ? data : []);
  };

  /** =========================
   * Search filter
   * ========================= */
  const filteredEvents = useMemo(() => {
    const q = norm(search);
    if (!q) return events;

    return (events || []).filter((ev) => {
      const hay = norm(
        `${ev?.title || ""} ${ev?.venue || ev?.location || ""} ${ev?.city || ""} ${ev?.category || ""}`
      );
      return hay.includes(q);
    });
  }, [events, search]);

  /** =========================
   * Create event
   * ========================= */
  const createEvent = async () => {
    const title = (newEvent.title || "").trim();
    const venue = (newEvent.venue || "").trim();
    const startsAtIso = datetimeLocalToIso(newEvent.starts_at);

    if (!title || !venue || !startsAtIso) {
      alert("Completa: Título, Fecha/Hora y Ubicación (recinto).");
      return;
    }

    const payload = {
      title,
      starts_at: startsAtIso,
      venue,
      city: (newEvent.city || "").trim() || null,
      category: (newEvent.category || "").trim() || null,
      image_url: (newEvent.image_url || "").trim() || null,
    };

    setLoading(true);
    const { error } = await supabase.from("events").insert([payload]);
    setLoading(false);

    if (error) {
      console.error("[admin/events] createEvent error:", error);
      alert("Error al crear evento (revisa consola).");
      return;
    }

    setNewEvent({ title: "", starts_at: "", venue: "", city: "", category: "", image_url: "" });
    await fetchEvents();
    alert("Evento creado ✅");
  };

  /** =========================
   * Start edit
   * ========================= */
  const startEdit = (ev) => {
    setEditingId(ev.id);
    setEditForm({
      id: ev.id,
      title: ev?.title || "",
      starts_at: isoToDatetimeLocal(ev?.starts_at),
      venue: ev?.venue || ev?.location || "",
      city: ev?.city || "",
      category: ev?.category || "",
      image_url: ev?.image_url || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ id: "", title: "", starts_at: "", venue: "", city: "", category: "", image_url: "" });
  };

  /** =========================
   * Save edit
   * ========================= */
  const saveEdit = async () => {
    if (!editingId) return;

    const title = (editForm.title || "").trim();
    const venue = (editForm.venue || "").trim();
    const startsAtIso = datetimeLocalToIso(editForm.starts_at);

    if (!title || !venue || !startsAtIso) {
      alert("Completa: Título, Fecha/Hora y Ubicación (recinto).");
      return;
    }

    const payload = {
      title,
      starts_at: startsAtIso,
      venue,
      city: (editForm.city || "").trim() || null,
      category: (editForm.category || "").trim() || null,
      image_url: (editForm.image_url || "").trim() || null,
    };

    setLoading(true);
    const { error } = await supabase.from("events").update(payload).eq("id", editingId);
    setLoading(false);

    if (error) {
      console.error("[admin/events] saveEdit error:", error);
      alert("Error al actualizar evento (revisa consola).");
      return;
    }

    cancelEdit();
    await fetchEvents();
    alert("Evento actualizado ✅");
  };

  /** =========================
   * Delete event (and its tickets)
   * ========================= */
  const deleteEvent = async (id) => {
    const ev = events.find((x) => x.id === id);
    const name = ev?.title || "este evento";

    if (!confirm(`¿Seguro que quieres eliminar "${name}"?\n\nEsto elimina también sus entradas.`)) return;

    setLoading(true);

    // Borra tickets asociados (por si no tienes ON DELETE CASCADE)
    const { error: ticketsErr } = await supabase.from("tickets").delete().eq("event_id", id);
    if (ticketsErr) {
      console.warn("[admin/events] delete tickets warning:", ticketsErr);
    }

    const { error } = await supabase.from("events").delete().eq("id", id);
    setLoading(false);

    if (error) {
      console.error("[admin/events] delete event error:", error);
      alert("Error al eliminar evento (revisa consola).");
      return;
    }

    if (editingId === id) cancelEdit();
    await fetchEvents();
    alert("Evento eliminado ✅");
  };

  /** =========================
   * UI
   * ========================= */
  if (checkingAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Validando permisos de administrador…
        </div>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Panel de eventos</h1>
          <p className="text-gray-600 mt-1">Administra nombre, fecha/hora, ubicación, categoría e imagen.</p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
        >
          Volver al panel
        </button>
      </div>

      {/* =========================
          Create new event
         ========================= */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-8">
        <h2 className="text-xl font-semibold mb-4">Crear nuevo evento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border p-2 rounded-xl"
            placeholder="Título del evento"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
          />

          <input
            type="datetime-local"
            className="border p-2 rounded-xl"
            value={newEvent.starts_at}
            onChange={(e) => setNewEvent({ ...newEvent, starts_at: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Ubicación / Recinto (ej: Movistar Arena)"
            value={newEvent.venue}
            onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Ciudad (opcional)"
            value={newEvent.city}
            onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Categoría (Rock, Pop, etc.)"
            value={newEvent.category}
            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Imagen URL (opcional) — pega un link tipo PuntoTicket"
            value={newEvent.image_url}
            onChange={(e) => setNewEvent({ ...newEvent, image_url: e.target.value })}
          />
        </div>

        {/* Preview imagen nueva */}
        <div className="mt-4 w-full h-44 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
          {newEvent.image_url ? (
            <img
              src={newEvent.image_url}
              alt="Preview"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm text-gray-400">Falta cargar imagen</span>
          )}
        </div>

        <button
          onClick={createEvent}
          disabled={loading}
          className="mt-5 px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creando…" : "Crear evento"}
        </button>
      </div>

      {/* =========================
          Search + list
         ========================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-10">
        <h2 className="text-2xl font-semibold">Eventos en backend</h2>

        <input
          className="border rounded-xl px-4 py-2 w-full md:max-w-sm"
          placeholder="Buscar por título, recinto, ciudad, categoría…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredEvents.length === 0 ? (
          <div className="text-gray-600">No hay eventos para mostrar.</div>
        ) : (
          filteredEvents.map((ev) => {
            const title = ev?.title || "Evento";
            const venue = ev?.venue || ev?.location || "";
            const city = ev?.city || "";
            const category = ev?.category || "";
            const startsAt = ev?.starts_at;
            const imageUrl = ev?.image_url || "";

            const isEditing = editingId === ev.id;

            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {/* Imagen (preview) */}
                <div className="w-full h-40 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center mb-4">
                  {imageUrl ? (
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-sm text-gray-400">Falta cargar imagen</span>
                  )}
                </div>

                {!isEditing ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{title}</h3>
                        <p className="mt-1 text-sm text-gray-600">📅 {formatEventDate(startsAt)}</p>
                        <p className="text-sm text-gray-600">
                          📍 {venue}
                          {venue && city ? " — " : ""}
                          {city}
                        </p>
                        {category && <p className="text-xs text-gray-500 mt-1">Categoría: {category}</p>}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(ev)}
                          className="px-3 py-1.5 rounded-xl border bg-white hover:bg-gray-50 text-blue-700 font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteEvent(ev.id)}
                          className="px-3 py-1.5 rounded-xl border bg-white hover:bg-red-50 text-red-700 font-semibold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 break-all">
                      <span className="font-semibold">image_url:</span> {imageUrl || "NULL"}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Editando: {title}</h3>

                    <div className="grid grid-cols-1 gap-3">
                      <input
                        className="border p-2 rounded-xl"
                        placeholder="Título"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      />

                      <input
                        type="datetime-local"
                        className="border p-2 rounded-xl"
                        value={editForm.starts_at}
                        onChange={(e) => setEditForm({ ...editForm, starts_at: e.target.value })}
                      />

                      <input
                        className="border p-2 rounded-xl"
                        placeholder="Recinto"
                        value={editForm.venue}
                        onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                      />

                      <input
                        className="border p-2 rounded-xl"
                        placeholder="Ciudad (opcional)"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      />

                      <input
                        className="border p-2 rounded-xl"
                        placeholder="Categoría (opcional)"
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      />

                      <input
                        className="border p-2 rounded-xl"
                        placeholder="Imagen URL (opcional)"
                        value={editForm.image_url}
                        onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                      />

                      {/* Preview edit */}
                      <div className="w-full h-40 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                        {editForm.image_url ? (
                          <img
                            src={editForm.image_url}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-sm text-gray-400">Falta cargar imagen</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={saveEdit}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
                      >
                        {loading ? "Guardando…" : "Guardar cambios"}
                      </button>

                      <button
                        onClick={cancelEdit}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
