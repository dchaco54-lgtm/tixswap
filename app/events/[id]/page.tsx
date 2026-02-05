import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import TicketCard from "./TicketCard";
import { getBulkSellerTrustSignals } from "@/lib/trustSignals";
import type { Database } from "@/src/types/database.types";

// ✅ Configuración crítica para evitar caché
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';


function isMissingRelationError(error: unknown) {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return msg.includes("tickets_public") && msg.includes("schema cache");
}

type TicketRow = Database["public"]["Views"]["tickets_public"]["Row"];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function formatDateCL(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
}

function formatTimeCL(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function getEventData(id: string) {
  const supabase = getSupabaseAdmin();

  // 1. Obtener evento
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return null;
  }

  // 2. Obtener tickets activos
  let tickets: TicketRow[] = [];
  const { data: publicTickets, error: ticketsError } = await supabase
    .from("tickets_public")
    .select("id, event_id, seller_id, seller_name, status, price, currency, sector, row_label, seat_label, section_label, created_at, title, sale_type")
    .eq("event_id", id)
    .in("status", ["active", "available"])
    .order("created_at", { ascending: false });

  if (ticketsError) {
    if (!isMissingRelationError(ticketsError)) {
      console.error("[EventPage] Error loading tickets:", ticketsError);
      return { event, tickets: [], trustSignals: {} };
    }

    const { data: legacyTickets, error: legacyErr } = await supabase
      .from("tickets")
      .select("id, event_id, seller_id, seller_name, status, price, currency, sector, row_label, seat_label, section_label, created_at, title, sale_type")
      .eq("event_id", id)
      .in("status", ["active", "available"])
      .order("created_at", { ascending: false });

    if (legacyErr) {
      console.error("[EventPage] Error loading legacy tickets:", legacyErr);
      return { event, tickets: [], trustSignals: {} };
    }

    tickets = legacyTickets || [];
  } else {
    tickets = publicTickets || [];
  }

  // 3. Obtener trust signals de todos los vendedores
  const sellerIds = Array.from(
    new Set((tickets || []).map((t: TicketRow) => t.seller_id).filter(Boolean))
  );

  // 4. Obtener trust signals de todos los vendedores
  const trustSignals = await getBulkSellerTrustSignals(sellerIds);

  console.log(`[EventPage] Loaded ${tickets?.length || 0} tickets for event ${id}`);

  return { event, tickets: tickets || [], trustSignals };
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const data = await getEventData(params.id);

  if (!data) {
    notFound();
  }

  const { event, tickets, trustSignals } = data;

  const title = event.title || event.name || "Evento";
  const date = event.starts_at ? formatDateCL(event.starts_at) : "";
  const time = event.starts_at ? formatTimeCL(event.starts_at) : "";
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const subtitle = [date && time ? `${date} · ${time}` : (date || time), place]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/events" className="text-blue-600 hover:underline">
        ← Volver a eventos
      </Link>

      <div className="mt-6 p-6 rounded-2xl border bg-white">
        {event.image_url && (
          <img
            src={event.image_url}
            alt={title}
            className="w-full h-48 object-cover rounded-xl mb-6"
          />
        )}
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <div className="text-gray-600 mt-2">{subtitle}</div>}
      </div>

      {event.description && (
        <div className="mt-6 p-6 rounded-2xl border bg-blue-50">
          <div className="whitespace-pre-wrap text-sm text-gray-700">
            {event.description}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">🛡️</span>
          <div className="text-xs text-gray-700 leading-snug">
            🔒 No hagas transacciones fuera de la plataforma<br/>
            ⚠️ Recuerda: no entregues tus datos personales antes de confirmar<br/>
            🛡️ Evita estafas - no compartas tus claves ni PIN<br/>
            📄 Siempre pide el PDF de la entrada al vendedor
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Entradas disponibles</h2>

      {tickets.length === 0 && (
        <div className="text-gray-600">Aún no hay entradas publicadas para este evento.</div>
      )}

      {tickets.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {tickets.map((ticket: TicketRow) => (
            <TicketCard 
              key={ticket.id} 
              ticket={ticket} 
              trustSignals={trustSignals[ticket.seller_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
