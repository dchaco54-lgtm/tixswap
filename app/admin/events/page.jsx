// app/admin/events/page.jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    location: "",
    category: "",
    image_url: "",
  });
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar eventos
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });
    if (!error) setEvents(data);
    else console.error(error);
  };

  // Crear evento
  const createEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.location) return alert("Completa todos los campos");

    setLoading(true);
    const { error } = await supabase.from("events").insert([newEvent]);
    setLoading(false);

    if (error) alert("Error al crear evento");
    else {
      alert("Evento creado correctamente");
      setNewEvent({ title: "", date: "", location: "", category: "", image_url: "" });
      fetchEvents();
    }
  };

  // Editar evento
  const updateEvent = async (id) => {
    setLoading(true);
    const { error } = await supabase.from("events").update(editingEvent).eq("id", id);
    setLoading(false);

    if (error) alert("Error al actualizar evento");
    else {
      alert("Evento actualizado correctamente");
      setEditingEvent(null);
      fetchEvents();
    }
  };

  // Eliminar evento + entradas asociadas
  const deleteEvent = async (id) => {
    if (!confirm("¿Seguro que quieres eliminar este evento y todas sus entradas?")) return;

    setLoading(true);

    // Primero borra las entradas
    await supabase.from("tickets").delete().eq("event_id", id);
    // Luego borra el evento
    const { error } = await supabase.from("events").delete().eq("id", id);

    setLoading(false);
    if (error) alert("Error al eliminar evento");
    else {
      alert("Evento y entradas eliminadas");
      fetchEvents();
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Panel de eventos</h1>

      {/* Crear nuevo evento */}
      <div className="bg-white p-5 rounded-2xl shadow mb-10">
        <h2 className="text-xl font-semibold mb-4">Crear nuevo evento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border p-2 rounded"
            placeholder="Título del evento"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
          />
          <input
            type="datetime-local"
            className="border p-2 rounded"
            value={newEvent.date}
            onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
          />
          <input
            className="border p-2 rounded"
            placeholder="Ubicación"
            value={newEvent.location}
            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
          />
          <input
            className="border p-2 rounded"
            placeholder="Categoría (Rock, Pop, etc.)"
            value={newEvent.category}
            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
          />
          <input
            className="border p-2 rounded col-span-full"
            placeholder="Imagen URL (opcional)"
            value={newEvent.image_url}
            onChange={(e) => setNewEvent({ ...newEvent, image_url: e.target.value })}
          />
        </div>
        <button
          onClick={createEvent}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          {loading ? "Creando..." : "Crear evento"}
        </button>
      </div>

      {/* Lista de eventos */}
      <h2 className="text-2xl font-semibold mb-4">Eventos en backend</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((ev) => (
          <div key={ev.id} className="bg-white shadow rounded-xl p-4 relative">
            {editingEvent?.id === ev.id ? (
              <>
                <input
                  className="border p-2 w-full mb-2 rounded"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                />
                <input
                  className="border p-2 w-full mb-2 rounded"
                  type="datetime-local"
                  value={editingEvent.date}
                  onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                />
                <input
                  className="border p-2 w-full mb-2 rounded"
                  value={editingEvent.location}
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                />
                <input
                  className="border p-2 w-full mb-2 rounded"
                  value={editingEvent.category}
                  onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
                />
                <input
                  className="border p-2 w-full mb-2 rounded"
                  placeholder="URL de imagen"
                  value={editingEvent.image_url}
                  onChange={(e) => setEditingEvent({ ...editingEvent, image_url: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => updateEvent(ev.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingEvent(null)}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-xl"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                {ev.image_url && (
                  <div className="mb-3">
                    <Image
                      src={ev.image_url}
                      alt={ev.title}
                      width={500}
                      height={300}
                      className="rounded-lg object-cover"
                    />
                  </div>
                )}
                <h3 className="text-lg font-semibold">{ev.title}</h3>
                <p className="text-sm text-gray-500">{new Date(ev.date).toLocaleString()}</p>
                <p className="text-sm">{ev.location}</p>
                <p className="text-sm text-gray-600 mt-1">Categoría: {ev.category || "—"}</p>
                <div className="flex justify-end gap-3 mt-3">
                  <button
                    onClick={() => setEditingEvent(ev)}
                    className="text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteEvent(ev.id)}
                    className="text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
