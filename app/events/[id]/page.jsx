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

function normStatus(status) {
  return (status ?? "").toString().trim().toLowerCase();
}

function isSoldStatus(status) {
  const s = normStatus(status);
  return ["sold", "vendida", "vendido", "consumed", "used"].includes(s);
}

function isHeldStatus(status) {
  const s = normStatus(status);
  return ["held", "hold", "reserved", "reservado", "locked", "pending_hold"].includes(s);
}

function isAvailableStatus(status) {
  const s = normStatus(status);
  if (!s) return true; // si no hay status, asumimos disponible
  return ["active", "available", "published", "for_sale", "listed", "on_sale"].includes(s);
}

function statusPill(status) {
  if (isSoldStatus(status)) return { label: "Vendida", cls: "bg-gray-200 text-gray-800" };
  if (isHeldStatus(status)) return { label: "Reservada", cls: "bg-yellow-100 text-yellow-900" };
  if (isAvailableStatus(status)) return { label: "Disponible", cls: "bg-green-100 text-green-900" };
  return { label: safe(status), cls: "bg-blue-100 text-blue-900" };
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
        <p className="text-red-600">Evento no encontrado.</p>
        <Link className="text-blue-600 underline" href="/events">
          Volver
        </Link>
      </div>
    );
  }

  const { data: ticketsData, error: ticketsError } = await admin
    .from("tickets")
    .select(
      "id,event_id,price,section,row,seat,notes,status,created_at,seller_id,seller_email"
    )
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const tickets = ticketsData ?? [];

  // Solo escondemos realmente vendidas; el resto se muestra (disponible o reservada o lo que sea)
  const visibleTickets = tickets.filter((t) => !isSoldStatus(t.status));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link className="text-blue-600 underline" href="/events">
            ← Volver a eventos
          </Link>
          <h1 className="text-3xl font-bold mt-3">{safe(event.title)}</h1>
          <p className="text-gray-600">
            {safe(event.city)} · {safe(event.venue)}
          </p>
        </div>

        <Link
          href={`/sell?eventId=${id}`}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          Publicar entrada
        </Link>
      </div>

      <h2 className="text-xl font-semibold mb-3">Entradas disponibles</h2>

      {ticketsError ? (
        <p className="text-red-600">No pude cargar las entradas: {ticketsError.message}</p>
      ) : visibleTickets.length === 0 ? (
        <p className="text-gray-600">No hay entradas disponibles por ahora.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleTickets.map((t) => {
            const pill = statusPill(t.status);
            const available = isAvailableStatus(t.status) && !isHeldStatus(t.status);

            return (
              <div
                key={t.id}
                className="border rounded-lg p-4 bg-white flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${pill.cls}`}>
                      {pill.label}
                    </span>
                  </div>

                  <p className="font-semibold text-lg">{formatCLP(t.price)}</p>

                  <p className="text-gray-700">
                    Sección: <b>{safe(t.section)}</b> · Fila: <b>{safe(t.row)}</b> · Asiento:{" "}
                    <b>{safe(t.seat)}</b>
                  </p>

                  {t.notes ? <p className="text-gray-600 mt-2">{t.notes}</p> : null}

                  <div className="mt-3">
                    <p className="text-sm text-gray-600">
                      Vende: <b>{displaySellerName(t.seller_email)}</b>
                    </p>
                    <SellerReputation sellerId={t.seller_id} />
                  </div>
                </div>

                <div className="min-w-[140px] flex flex-col items-end gap-2">
                  {available ? (
                    <Link
                      href={`/checkout/${t.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                    >
                      Comprar
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md cursor-not-allowed"
                      title="Esta entrada está reservada o no está disponible ahora"
                    >
                      No disponible
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
