export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function formatCLP(n) {
  const val = Number(n);
  if (!Number.isFinite(val)) return "$0";
  return val.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function isAvailableStatus(status) {
  const s = (status || "").toString().trim().toLowerCase();

  // Legacy/empty rows: treat as available
  if (!s) return true;

  // Explicit available statuses
  const available = new Set([
    "active",
    "available",
    "published",
    "listed",
    "for_sale",
    "on_sale",
    "onsale",
  ]);
  if (available.has(s)) return true;

  // Explicit not-available statuses
  const notAvailable = new Set([
    "sold",
    "paid",
    "completed",
    "cancelled",
    "canceled",
    "expired",
    "deleted",
    "inactive",
  ]);
  if (notAvailable.has(s)) return false;

  // Conservative default: if we don't recognize it, assume it's available.
  // (This avoids “desaparecieron todas las entradas” when a new status is introduced.)
  return true;
}

async function fetchTickets(admin, eventId) {
  const attempts = [
    {
      label: "price_clp+seat",
      select:
        "id, event_id, price_clp, sector, row, seat, seat_info, seller_id, seller_name, status, created_at",
    },
    {
      label: "price+seat",
      select:
        "id, event_id, price, sector, row, seat, seat_info, seller_id, seller_name, status, created_at",
    },
    {
      label: "price_clp minimal",
      select: "id, event_id, price_clp, seller_id, seller_name, status, created_at",
    },
    {
      label: "price minimal",
      select: "id, event_id, price, seller_id, seller_name, status, created_at",
    },
    { label: "*", select: "*" },
  ];

  let lastError = null;

  for (const a of attempts) {
    const res = await admin
      .from("tickets")
      .select(a.select)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (!res.error) {
      return { data: res.data || [], error: null, used: a.label };
    }

    lastError = res.error;
  }

  return { data: [], error: lastError, used: null };
}

export default async function EventPage({ params }) {
  const eventId = params?.id;
  const admin = supabaseAdmin();

  // 1) Load event
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Evento</h1>
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Error cargando el evento.
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Evento no encontrado</h1>
        <p className="mt-2 text-gray-600">Verifica el enlace e inténtalo nuevamente.</p>
      </div>
    );
  }

  // 2) Load tickets
  const { data: ticketsRaw, error: ticketsError } = await fetchTickets(admin, eventId);
  const tickets = (ticketsRaw || []).filter((t) => isAvailableStatus(t?.status));

  const title = event?.title || event?.name || "Evento";
  const city = event?.city || event?.location_city || "";
  const venue = event?.venue || event?.location_venue || "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <Link href="/events" className="text-blue-600 hover:underline">
          ← Volver a eventos
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-gray-600">
            {city}
            {city && venue ? " · " : ""}
            {venue}
          </p>
        </div>

        <Link
          href={`/sell?eventId=${encodeURIComponent(eventId)}`}
          className="tix-btn tix-btn-success whitespace-nowrap"
        >
          Publicar entrada
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Entradas disponibles</h2>

        {ticketsError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            Error al cargar las entradas. (Tip: suele pasar cuando cambian nombres de columnas)
          </div>
        ) : null}

        {tickets.length === 0 ? (
          <p className="mt-3 text-gray-600">No hay entradas disponibles por ahora.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {tickets.map((t) => {
              const price = Number(t?.price_clp ?? t?.price ?? 0);
              const seller = t?.seller_name || "Vendedor";

              const sector = t?.sector || "-";
              const row = t?.row || "-";
              const seat = t?.seat || "-";
              const seatInfo = t?.seat_info;

              const locationText = seatInfo
                ? seatInfo
                : `${sector !== "-" ? sector : "-"} / ${row !== "-" ? row : "-"} / ${seat !== "-" ? seat : "-"}`;

              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm"
                >
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatCLP(price)}</div>
                    <div className="mt-2 text-sm text-gray-600">Ubicación: {locationText}</div>
                    <div className="mt-2 text-sm text-gray-600">Vendedor: {seller}</div>
                  </div>

                  <Link
                    href={`/checkout/${t.id}`}
                    className="tix-btn tix-btn-primary px-8 py-3 text-base"
                  >
                    Comprar
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

