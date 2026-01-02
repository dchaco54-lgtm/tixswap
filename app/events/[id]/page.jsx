import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatCLP } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safe(v) {
  return (v ?? "").toString();
}

function isAvailableStatus(status) {
  // Si la tabla no tiene columna `status`, status será undefined → lo tratamos como disponible
  const s = (status ?? "").toString().toLowerCase().trim();
  if (!s) return true;
  return ["active", "published", "available", "for_sale"].includes(s);
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
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Evento no encontrado</h1>
        <p className="text-gray-600 mt-2">
          No pudimos cargar el evento. Vuelve a intentarlo.
        </p>
        <Link
          href="/events"
          className="inline-block mt-4 text-blue-600 hover:underline"
        >
          Volver a eventos
        </Link>
      </div>
    );
  }

  // IMPORTANTE: select("*") para no romper si faltan columnas (status/created_at/etc).
  // Orden y filtros los hacemos en JS (más robusto).
  const { data: ticketsRaw, error: tErr } = await admin
    .from("tickets")
    .select("*")
    .eq("event_id", eventId);

  if (tErr) {
    console.error(`[events/${eventId}] Error leyendo tickets`, tErr);
  }

  const tickets = (ticketsRaw ?? [])
    .filter((t) => isAvailableStatus(t?.status))
    .sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/events" className="text-sm text-blue-600 hover:underline">
            ← Volver a eventos
          </Link>

          <h1 className="text-4xl font-extrabold mt-2">{safe(event.title)}</h1>
          <div className="text-gray-600 mt-2">
            {safe(event.city)}{" "}
            {event.venue ? <span>· {safe(event.venue)}</span> : null}
          </div>
        </div>

        <Link
          href={`/sell?eventId=${eventId}`}
          className="bg-green-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
        >
          Publicar entrada
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-bold">Entradas disponibles</h2>

        {tErr ? (
          <p className="text-red-600 mt-3">Error cargando entradas.</p>
        ) : tickets.length === 0 ? (
          <p className="text-gray-600 mt-3">
            Aún no hay entradas publicadas para este evento.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="border rounded-2xl p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-semibold text-lg">
                    {t.section ? `Sección ${safe(t.section)}` : "Entrada"}
                    {t.row ? ` · Fila ${safe(t.row)}` : ""}
                    {t.seat ? ` · Asiento ${safe(t.seat)}` : ""}
                  </div>
                  <div className="text-gray-600 mt-1">
                    Precio:{" "}
                    <span className="font-semibold">
                      {formatCLP(Number(t.price) || 0)}
                    </span>
                    {t.notes ? (
                      <span className="block mt-1 text-sm">
                        {safe(t.notes)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <Link
                  href={`/checkout/${t.id}`}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
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

