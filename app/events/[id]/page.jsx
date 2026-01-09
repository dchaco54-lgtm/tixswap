import TicketCard from "@/components/ticketCard";
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { supabaseReadServer } from "@/lib/supabaseReadServer";
import { supabaseServiceOptional } from "@/lib/supabaseServiceOptional";
import { formatCLP } from "@/lib/format";
import SellerReputation from "./sellerReputation";

function shortName(fullName) {
  if (!fullName) return "Vendedor";
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function isAvailableStatus(status) {
  // Si no hay columna status, lo consideramos "disponible" (compatibilidad)
  if (!status) return true;
  const s = String(status).toLowerCase();
  return s === "active" || s === "available" || s === "published" || s === "listed";
}

async function fetchEvent(supabase, eventId) {
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
  return { data, error };
}

async function fetchTickets(supabase, eventId) {
  // Intentamos con un select estándar (sin columnas opcionales que rompen)
  const { data, error } = await supabase
    .from("tickets")
    .select("id,event_id,price,section,row,seat,status,seller_id,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  return { data: data || [], error };
}

export default async function EventPage({ params }) {
  const { id } = params;

  // Clients: service role (si existe), auth cookies, anon
  const cookieStore = cookies();
  const supabaseAuth = createServerComponentClient({ cookies: () => cookieStore });
  const supabaseService = supabaseServiceOptional();
  const supabaseAnon = supabaseReadServer();
  const readClients = [supabaseService, supabaseAuth, supabaseAnon].filter(Boolean);

  const profileClient = supabaseService || supabaseAuth;

  // Helper: query against multiple clients until it returns data
  const tryQuery = async (fn) => {
    let lastErr = null;
    for (const client of readClients) {
      const { data, error } = await fn(client);
      if (!error && data) return { data, error: null };
      lastErr = error;
    }
    return { data: null, error: lastErr };
  };

  // Fetch event (smart)
  const { data: event, error: eventErr } = await tryQuery((client) => fetchEvent(client, id));

  // Fetch tickets (smart: prefer first non-empty)
  let ticketsRaw = [];
  let ticketsErr = null;
  for (const client of readClients) {
    const { data, error } = await fetchTickets(client, id);
    if (error) {
      ticketsErr = error;
      continue;
    }
    ticketsRaw = data || [];
    ticketsErr = null;
    if ((data || []).length > 0) break;
  }

  const tickets = (ticketsRaw || []).filter((t) => isAvailableStatus(t.status));

  // Best-effort: resolve seller names
  const sellerIds = Array.from(new Set((tickets || []).map((t) => t?.seller_id).filter(Boolean)));
  const sellerNameById = new Map();

  if (sellerIds.length > 0) {
    try {
      const { data: sellers, error: sellersErr } = await profileClient
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

  if (eventErr || !event) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Link className="text-blue-600 underline" href="/events">
          ← Volver a eventos
        </Link>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Error cargando evento.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link className="text-blue-600 underline" href="/events">
        ← Volver a eventos
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{event?.name || "Evento"}</h1>
          <p className="text-slate-600">
            {(event?.city || "Chile") + (event?.venue ? ` · ${event.venue}` : "")}
          </p>
        </div>

        <Link
          href="/tickets/publish"
          className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          Publicar entrada
        </Link>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Entradas disponibles</h2>

      {ticketsErr ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Error obteniendo tickets.
        </div>
      ) : tickets.length === 0 ? (
        <p className="mt-2 text-slate-600">No hay entradas disponibles por ahora.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={{
                id: t.id,
                price: t.price,
                section: t.section,
                row: t.row,
                seat: t.seat,
                sellerName: sellerNameById.get(t.seller_id) || "Vendedor nuevo",
              }}
              priceLabel={formatCLP(t.price)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
