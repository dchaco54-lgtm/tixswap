// app/events/[id]/page.jsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 30;

async function getEventAndTickets(id) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, date_display, venue, city")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    console.error("Error cargando evento:", eventError);
    return { event: null, tickets: [] };
  }

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select(
      "id, sector, row_label, seat_label, price, seller_name, seller_rating"
    )
    .eq("event_id", id)
    .order("price", { ascending: true });

  if (ticketsError) {
    console.error("Error cargando tickets:", ticketsError);
  }

  return { event, tickets: tickets ?? [] };
}

export default async function EventPage({ params }) {
  const { id } = params;
  const { event, tickets } = await getEventAndTickets(id);

  if (!event) {
    notFound();
  }

  const sectors = Array.from(new Set(tickets.map((t) => t.sector)));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Breadcrumb / volver */}
        <Link
          href="/events"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver a eventos
        </Link>

        {/* Cabecera evento */}
        <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {event.name}
              </h1>
              <p className="mt-2 text-gray-700">
                📅 {event.date_display}
                <br />
                📍 {event.venue} · {event.city}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-medium">Reventa segura en TixSwap</p>
              <p className="mt-1 text-xs text-gray-500">
                Pagas solo cuando el vendedor sube la entrada y la validamos.
              </p>
            </div>
          </div>
        </section>

        {/* Contenido principal: listado de entradas + lateral */}
        <section className="mt-6 grid gap-6 md:grid-cols-[2fr,1fr]">
          {/* Columna izquierda: entradas */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Entradas disponibles
              </h2>

              <div className="flex flex-wrap gap-2 text-sm">
                {/* Filtro por sector (solo UI de momento) */}
                <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
                  <option>Todos los sectores</option>
                  {sectors.map((sector) => (
                    <option key={sector}>{sector}</option>
                  ))}
                </select>

                {/* Orden por precio (solo UI de momento) */}
                <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
                  <option>Precio: menor a mayor</option>
                  <option>Precio: mayor a menor</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {tickets.length > 0 ? (
                tickets.map((ticket) => {
                  const seatText =
                    ticket.row_label || ticket.seat_label
                      ? `Fila ${ticket.row_label ?? "-"}, asiento ${
                          ticket.seat_label ?? "-"
                        }`
                      : "Asientos sin numerar";

                  return (
                    <article
                      key={ticket.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {ticket.sector} · {seatText}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {ticket.seller_name
                            ? `Publicado por ${ticket.seller_name}`
                            : "Vendedor TixSwap"}
                          {ticket.seller_rating
                            ? ` · ${Number(
                                ticket.seller_rating
                              ).toFixed(1)}★`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-base font-semibold text-emerald-600">
                          $
                          {ticket.price.toLocaleString("es-CL", {
                            minimumFractionDigits: 0,
                          })}
                        </p>
                        <button className="mt-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                          Comprar
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">
                  Todavía no hay publicaciones para este evento.
                </p>
              )}
            </div>
          </div>

          {/* Columna derecha: info / recomendaciones */}
          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">
                Cómo funciona TixSwap
              </h3>
              <ol className="mt-2 space-y-1 text-xs text-gray-600">
                <li>1. Pagas y el vendedor sube su entrada.</li>
                <li>2. La revisamos y la dejamos en tu correo.</li>
                <li>3. Si algo no calza, te devolvemos la plata.</li>
              </ol>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">
                Recomendaciones del vendedor
              </h3>
              <p className="mt-2 text-xs text-gray-600">
                Aquí después vamos a mostrar el resumen de calificaciones del
                vendedor, similar a Falabella / Mercado Libre: promedio, número
                de ventas, comentarios, etc.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
