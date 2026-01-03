// app/events/[id]/page.jsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatCLP } from "@/lib/format";
import SellerReputation from "./sellerReputation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAvailableStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "" || s === "active" || s === "available" || s === "published";
}

async function fetchTickets(admin, eventId) {
  // Intento 1: con ubicación + seller
  let res = await admin
    .from("tickets")
    .select("id,event_id,price,status,notes,sector,row,seat,created_at,seller_id")
    .eq("event_id", eventId);

  if (!res.error) return res;

  // Fallback 1: mínimo con seller_id (para no caerse por columnas de ubicación)
  res = await admin
    .from("tickets")
    .select("id,event_id,price,status,created_at,seller_id")
    .eq("event_id", eventId);

  if (!res.error) return res;

  // Fallback 2: ultra mínimo
  return admin
    .from("tickets")
    .select("id,event_id,price,status,created_at")
    .eq("event_id", eventId);
}

function shortName(fullName) {
  const raw = String(fullName || "").trim();
  if (!raw) return "—";
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0] || raw;
  const last = parts.length >= 2 ? parts[parts.length - 1] : "";
  const lastInitial = last ? `${last[0].toUpperCase()}.` : "";
  return lastInitial ? `${first} ${lastInitial}` : first;
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

  // Resolver nombres de vendedores (best-effort)
  const sellerIds = Array.from(
    new Set((tickets || []).map((t) => t?.seller_id).filter(Boolean))
  );

  const sellerNameById = new Map();
  if (sellerIds.length > 0) {
    try {
      const { data: sellers, error: sellersErr } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", sellerIds)
        .limit(2000);

      if (!sellersErr && Array.isArray(sellers)) {
        for (const s of sellers) {
          if (s?.id) sellerNameById.set(s.id, shortName(s?.full_name));
        }
      }
    } catch {
      // noop
    }
  }

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
            <div
              key={t.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-slate-900">
                    {formatCLP(t.price)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Ubicación:{" "}
                    <span className="font-medium text-slate-800">
                      {t.sector ?? "—"} / {t.row ?? "—"} / {t.seat ?? "—"}
                    </span>
                  </p>
                </div>

                <Link
                  className="shrink-0 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"
                  href={`/checkout/${t.id}`}
                >
                  Comprar
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Vendedor:{" "}
                  <span className="font-medium text-slate-900">
                    {t?.seller_id ? sellerNameById.get(t.seller_id) || "—" : "—"}
                  </span>
                </p>

                <SellerReputation sellerId={t?.seller_id ?? null} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
