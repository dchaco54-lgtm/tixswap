import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";
import { notFound } from "next/navigation";

function isAvailableStatus(status) {
  // Public statuses we consider "available".
  // NOTE: "listed" is used in our checkout API and DB.
  const s = String(status ?? "listed").trim().toLowerCase();
  return ["listed", "active", "available", "published"].includes(s);
}

function formatCLP(value) {
  const n = typeof value === "number" ? value : parseInt(String(value || "0").replace(/\D/g, ""), 10) || 0;
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

async function fetchEvent(eventId) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) return null;
  return data;
}

async function fetchTickets(eventId) {
  const { data: ticketsRaw, error: ticketsErr } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (ticketsErr) return [];

  const tickets = (ticketsRaw || []).filter((t) => isAvailableStatus(t.status));
  return tickets;
}

async function fetchSellerNamesByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  if (error) return {};
  const map = {};
  for (const p of data || []) {
    map[p.id] = p.full_name || p.email || "Vendedor";
  }
  return map;
}

export default async function EventPage({ params }) {
  const id = params?.id;
  if (!id) return notFound();

  const event = await fetchEvent(id);
  if (!event) return notFound();

  const tickets = await fetchTickets(id);

  const sellerIds = [...new Set((tickets || []).map((t) => t.seller_id).filter(Boolean))];
  const sellerNameById = await fetchSellerNamesByIds(sellerIds);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/events" className="text-blue-600 hover:underline">
          ← Volver a eventos
        </Link>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{event.title || event.name}</h1>
            <p className="mt-1 text-gray-600">
              {(event.city || "Chile") + " · " + (event.venue || event.location || "")}
            </p>
          </div>

          <Link
            href="/sell"
            className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
          >
            Publicar entrada
          </Link>
        </div>

        <h2 className="mt-10 text-2xl font-bold text-gray-900">Entradas disponibles</h2>

        {tickets.length === 0 ? (
          <p className="mt-4 text-gray-600">No hay entradas disponibles por ahora.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="text-2xl font-bold text-gray-900">{formatCLP(t.price || t.value || t.amount || t.price_clp)}</div>
                  <div className="mt-1 text-gray-600">
                    Ubicación: {t.section || "-"} / {t.row || "-"} / {t.seat || "-"}
                  </div>
                  <div className="mt-2 text-gray-600">
                    Vendedor: {sellerNameById[t.seller_id] || "Vendedor"}
                  </div>
                </div>

                <Link
                  href={`/checkout/${t.id}`}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
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

