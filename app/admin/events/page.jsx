// app/admin/events/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** Helpers */
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

export default function AdminEventsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");

  const [newEvent, setNewEvent] = useState({
    title: "",
    starts_at: "",
    venue: "",
    city: "",
    category: "",
    image_url: "",
  });

  const [editingEvent, setEditingEvent] = useState(null); // { id, title, starts_at(datetime-local), venue, city, category, image_url }
  const [loading, setLoading] = useState(false);

  /** Admin guard (ZIP-style): profiles.role === "admin" */
  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.replace(`/login?redirectTo=${encodeURIComponent("/admin/events")}`);
        return;
      }

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.warn("[admin/events] profiles role error:", profileErr);
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
    };

    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchEvents() {
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
  }

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return events;
    return (events || []).filter((ev) => {
      const hay = norm(
        `${ev?.title || ""} ${ev?.venue || ev?.location || ""} ${ev?.city || ""} ${ev?.category || ""}`
      );
      return hay.includes(q);
    });
  }, [events, search]);

  /** Create event (verificado con select().single()) */
  const createEvent = async () => {
    const title = newEvent.title.trim();
    const venue = newEvent.venue.trim();
    const starts_at_iso = datetimeLocalToIso(newEvent.starts_at);

    if (!title || !venue || !starts_at_iso) {
      alert("Completa: Título, Fecha/Hora y Ubicación (recinto)");
      return;
    }

    setLoading(true);

    const payload = {
      title,
      starts_at: starts_at_iso,
      venue,
      city: newEvent.city.trim() || null,
      category: newEvent.category.trim() || null,
      image_url: newEvent.image_url.trim() || null,
    };

    const { data, error } = await supabase
      .from("events")
      .insert([payload])
      .select("*")
      .single();

    setLoading(false);

    if (error) {
      console.error("[admin/events] createEvent error:", error);
      alert(`Error al crear evento: ${error.message}`);
      return;
    }

    setNewEvent({ title: "", starts_at: "", venue: "", city: "", category: "", image_url: "" });
    await fetchEvents();
    alert(`Evento creado ✅ (${data?.title || "OK"})`);
  };

  const startEdit = (ev) => {
    setEditingEvent({
      id: ev.id,
      title: ev?.title || "",
      starts_at: isoToDatetimeLocal(ev?.starts_at),
      venue: ev?.venue || ev?.location || "",
      city: ev?.city || "",
      category: ev?.category || "",
      image_url: ev?.image_url || "",
    });
  };

  /** Update event (verificado con select().single(): si no cambia fila -> error y te lo dice) */
  const updateEvent = async () => {
    if (!editingEvent?.id) return;

    const title = (editingEvent.title || "").trim();
    const venue = (editingEvent.venue || "").trim();
    const starts_at_iso = datetimeLocalToIso(editingEvent.starts_at);

    if (!title || !venue || !starts_at_iso) {
      alert("Completa: Título, Fecha/Hora y Ubicación (recinto)");
      return;
    }

    setLoading(true);

    const payload = {
      title,
      starts_at: starts_at_iso,
      venue,
      city: (editingEvent.city || "").trim() || null,
      category: (editingEvent.category || "").trim() || null,
      image_url: (editingEvent.image_url || "").trim() || null,
    };

    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", editingEvent.id)
      .select("*")
      .single();

    setLoading(false);

    if (error) {
      console.error("[admin/events] updateEvent error:", error);
      alert(`No se pudo actualizar (RLS/columna/id): ${error.message}`);
      return;
    }

    setEditingEvent(null);
    await fetchEvents();

    alert(`Evento actualizado ✅ (${data?.title || "OK"})`);
  };

  const deleteEvent = async (id) => {
    const ev = events.find((x) => x.id === id);
    const name = ev?.title || "este evento";

    if (!confirm(`¿Seguro que quieres eliminar "${name}" y todas sus entradas?`)) return;

    setLoading(true);

    const { error: tErr } = await supabase.from("tickets").delete().eq("event_id", id);
    if (tErr) console.warn("[admin/events] delete tickets warning:", tErr);

    const { error } = await supabase.from("events").delete().eq("id", id);

    setLoading(false);

    if (error) {
      console.error("[admin/events] deleteEvent error:", error);
      alert(`Error al eliminar evento: ${error.message}`);
      return;
    }

    await fetchEvents();
    alert("Evento eliminado ✅");
  };

  if (checkingAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Validando permisos de administrador...
        </div>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Panel de eventos</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      {/* Crear nuevo evento */}
      <div className="bg-white p-5 rounded-2xl shadow mb-10">
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
            placeholder="Ubicación (recinto)"
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
            placeholder="Categoría (opcional)"
            value={newEvent.category}
            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="URL de imagen (opcional)"
            value={newEvent.image_url}
            onChange={(e) => setNewEvent({ ...newEvent, image_url: e.target.value })}
          />
        </div>

        {/* Preview create */}
        <div className="mt-4 w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
          {newEvent.image_url ? (
            <img src={newEvent.image_url} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm text-slate-400">Falta cargar imagen</span>
          )}
        </div>

        <button
          onClick={createEvent}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear evento"}
        </button>
      </div>

      {/* Buscador */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-2xl font-semibold">Eventos en backend</h2>
        <input
          className="border rounded-xl px-4 py-2 w-full max-w-sm"
          placeholder="Buscar evento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((ev) => {
          const title = ev?.title || "Evento";
          const venue = ev?.venue || ev?.location || "";
          const city = ev?.city || "";
          const imageUrl = ev?.image_url || "";

          return (
            <div key={ev.id} className="bg-white shadow rounded-xl p-4 relative">
              {editingEvent?.id === ev.id ? (
                <>
                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    type="datetime-local"
                    value={editingEvent.starts_at}
                    onChange={(e) => setEditingEvent({ ...editingEvent, starts_at: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="Ubicación (recinto)"
                    value={editingEvent.venue}
                    onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="Ciudad (opcional)"
                    value={editingEvent.city}
                    onChange={(e) => setEditingEvent({ ...editingEvent, city: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="Categoría (opcional)"
                    value={editingEvent.category}
                    onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="URL de imagen (opcional)"
                    value={editingEvent.image_url}
                    onChange={(e) => setEditingEvent({ ...editingEvent, image_url: e.target.value })}
                  />

                  {/* Preview edit */}
                  <div className="mb-3 w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                    {editingEvent.image_url ? (
                      <img
                        src={editingEvent.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-sm text-slate-400">Falta cargar imagen</span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={updateEvent}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-60"
                    >
                      {loading ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditingEvent(null)}
                      disabled={loading}
                      className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Imagen */}
                  <div className="mb-3 w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm text-slate-400">Falta cargar imagen</span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-gray-500">{ev?.starts_at ? formatEventDate(ev.starts_at) : "(Sin fecha)"}</p>
                  <p className="text-sm">
                    {venue || "—"}
                    {venue && city ? " — " : ""}
                    {city || ""}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Categoría: {ev?.category || "—"}</p>

                  <div className="flex justify-end gap-3 mt-3">
                    <button onClick={() => startEdit(ev)} className="text-blue-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => deleteEvent(ev.id)} className="text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
