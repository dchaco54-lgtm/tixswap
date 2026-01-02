import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatCLP } from "@/lib/format";
import SellerReputation from "./sellerReputation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function displaySellerName(raw) {
  if (!raw) return "—";
  const s = String(raw);
  if (s.includes("@")) return s.split("@")[0];
  return s;
}

function safe(v) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

function isAvailableStatus(status) {
  const s = (status ?? "").toString().toLowerCase().trim();
  if (!s) return true; // si no hay columna status, no filtramos
  return ["active", "published", "available", "for_sale"].includes(s);
}

export default async function EventDetailPage({ params }) {
  const { id } = params;
  const admin = supabaseAdmin();

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Evento no encontrado</h1>
        <Link className="text-blue-600 underline" href="/events">
          Volver a eventos
        </Link>
      </div>
    );
  }

  // Tickets disponibles (publicados) del evento
  let tickets = [];
  let ticketsError = null;
  try {
    const { data, error } = await admin
      .from("tickets")
      .select("*")
      .eq("event_id", id);

    if (error) {
      ticketsError = error.message;
    } else {
      tickets = (data ?? [])
        .filter((t) => isAvailableStatus(t?.status))
        .sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));
    }
  } catch (e) {
    ticketsError = e?.message || "Error cargando entradas";
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link href="/events" className="text-blue-600 underline">
        ← Volver a eventos
      </Link>

      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-gray-600 mt-1">
            {event.city} · {event.venue}
          </p>
        </div>

        <Link
          href={`/dashboard/sell?eventId=${event.id}`}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full font-medium whitespace-nowrap"
        >
          Publicar entrada
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold">Entradas disponibles</h2>

        {ticketsError ? (
          <p className="text-red-600 mt-3">
            No pude cargar las entradas ahora. {ticketsError}
          </p>
        ) : tickets.length === 0 ? (
          <p className="text-gray-600 mt-3">
            No hay entradas disponibles por ahora.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="bg-white border rounded-2xl p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold truncate">
                          {safe(t.title) === "—" ? event.title : safe(t.title)}
                        </h3>
                        {t.notes ? (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {t.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                      <div>
                        <dt className="text-slate-500">Valor</dt>
                        <dd className="font-semibold">{formatCLP(t.price)}</dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">Sector</dt>
                        <dd className="font-medium">
                          {safe(t.sector || t.section)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">Fila</dt>
                        <dd className="font-medium">{safe(t.fila || t.row)}</dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">Asiento</dt>
                        <dd className="font-medium">
                          {safe(t.asiento || t.seat)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">Vendedor</dt>
                        <dd className="font-medium">
                          {displaySellerName(t.seller_name) || "—"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">Reputación</dt>
                        <dd className="font-medium">
                          {t.seller_id ? (
                            <SellerReputation sellerId={t.seller_id} />
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* CTA */}
                  <div className="shrink-0 flex items-center justify-end">
                    <Link
                      href={`/checkout/${t.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold"
                    >
                      Comprar
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
