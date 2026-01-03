// app/events/[id]/page.jsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatCLP } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAvailableStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "" || s === "active" || s === "available" || s === "published";
}

async function fetchTickets(admin, eventId) {
  // Intento 1: con ubicación
  let res = await admin
    .from("tickets")
    .select("id,event_id,price,status,notes,sector,row,seat,created_at")
    .eq("event_id", eventId);

  if (!res.error) return res;

  // Fallback: mínimo (para que nunca se caiga por columnas)
  res = await admin
    .from("tickets")
    .select("id,event_id,price,status,created_at")
    .eq("event_id", eventId);

  return res;
}

export default async function EventPage({ params }) {
  const admin = supabaseAdmin();
  const { id } = params;

  const { data: event, error: eventErr } = await admin
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventErr || !event) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Link className="text-blue-600 underline" href="/events">
          ← Volver a eventos
        </Link>
        <div className="mt-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
          Evento no encontrado.
        </div>
      </div>
    );
  }

  const { data: ticketsRaw, error: ticketsErr } = await fetchTickets(admin, id);

  const tickets = (ticketsRaw || []).filter((t) => isAvailableStatus(t.status));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link className="text-blue-600 underline" href="/events">
        ← Volver a eventos
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-gray-600">
            {event.city} · {event.venue}
          </p>
        </div>

        <Link
          href={`/tickets/publish?eventId=${event.id}`}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          Publicar entrada
        </Link>
      </div>

      <h2 className="text-xl font-semibold mt-10">Entradas disponibles</h2>

      {ticketsErr ? (
        <p className="text-red-600 mt-2">
          No pude cargar las entradas: {ticketsErr.message}
        </p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-600 mt-2">No hay entradas disponibles por ahora.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {tickets.map((t) => (
            <div key={t.id} className="border rounded-lg p-4 bg-white flex justify-between gap-4">
              <div>
                <p className="font-semibold">{formatCLP(t.price)}</p>
                <p className="text-sm text-gray-600">
                  Ubicación:{" "}
                  <b>
                    {t.sector ?? "—"} / {t.row ?? "—"} / {t.seat ?? "—"}
                  </b>
                </p>
              </div>

              <Link
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md h-fit"
                href={`/checkout/${t.id}`}
              >
                Comprar
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
