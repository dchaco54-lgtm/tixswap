// app/events/[id]/page.jsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatCLP } from "@/lib/format";

function safe(v) {
  return (v ?? "").toString();
}

export default async function EventDetailPage({ params }) {
  const eventId = params?.id;
  const admin = supabaseAdmin();

  const { data: event, error: eErr } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eErr || !event) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <Link href="/events" className="text-sm text-slate-600 hover:text-blue-600">
          ← Volver
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Evento no encontrado</h1>
        <p className="mt-2 text-slate-600">Revisa que el evento exista.</p>
      </div>
    );
  }

  const { data: ticketsRaw, error: tErr } = await admin
    .from("tickets")
    .select("id, price, section, row, seat, notes, status, seller_id, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const tickets = (ticketsRaw || []).filter((t) => (t?.status || "active") === "active");

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/events" className="text-sm text-slate-600 hover:text-blue-600">
            ← Volver a eventos
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            {event?.title || event?.name || "Evento"}
          </h1>
          <p className="mt-2 text-slate-600">
            {event?.venue || event?.location || ""} {event?.city ? `· ${event.city}` : ""}
          </p>
        </div>

        <Link
          href="/sell"
          className="bg-green-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
        >
          Publicar entrada
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Entradas disponibles</h2>

        {tErr ? (
          <p className="mt-4 text-red-600">Error cargando entradas.</p>
        ) : tickets.length === 0 ? (
          <p className="mt-4 text-slate-600">
            Aún no hay entradas publicadas para este evento.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="bg-white border rounded-xl p-5 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
                    {t.section && <span>Sección: <b>{safe(t.section)}</b></span>}
                    {t.row && <span>Fila: <b>{safe(t.row)}</b></span>}
                    {t.seat && <span>Asiento: <b>{safe(t.seat)}</b></span>}
                  </div>

                  {t.notes && (
                    <p className="mt-2 text-sm text-slate-600">
                      {safe(t.notes)}
                    </p>
                  )}

                  <p className="mt-3 text-lg font-bold text-slate-900">
                    {formatCLP(t.price)}
                  </p>
                </div>

                <Link
                  href={`/checkout/${t.id}`}
                  className="shrink-0 bg-blue-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
                >
                  Comprar
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
