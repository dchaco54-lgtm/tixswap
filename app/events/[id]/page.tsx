// app/events/[id]/page.tsx
import Image from "next/image";
import TicketCard from "./TicketCard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBulkSellerTrustSignals } from "@/lib/trustSignals";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { id: string } }) {
  const eventId = params.id;

  const { data: event, error: eventErr } = await supabaseAdmin
    .from("events")
    .select("id, name, venue, city, date, image_url")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold">Evento no encontrado</h1>
      </div>
    );
  }

  const { data: tickets, error: ticketsErr } = await supabaseAdmin
    .from("tickets")
    .select("id, event_id, section, row, seat, price, status, sold, user_id, created_at")
    .eq("event_id", eventId)
    .eq("status", "active")
    .eq("sold", false)
    .order("created_at", { ascending: false });

  if (ticketsErr) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-red-600 mt-2">Error cargando tickets.</p>
      </div>
    );
  }

  const sellerIds = [...new Set((tickets || []).map((t) => t.user_id).filter(Boolean))];
  const sellerTrust = await getBulkSellerTrustSignals(sellerIds);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex gap-4 items-center mb-6">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.name}
            width={80}
            height={80}
            className="rounded-lg object-cover"
          />
        ) : null}

        <div>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <p className="text-gray-600">
            {event.venue} — {event.city}
          </p>
          <p className="text-gray-500">
            {event.date ? new Date(event.date).toLocaleString("es-CL") : ""}
          </p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">
        Entradas disponibles ({tickets?.length || 0})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(tickets || []).map((ticket) => {
          const trust = sellerTrust?.[ticket.user_id] || null;

          // seller “safe” (sin email)
          const seller = trust
            ? { id: ticket.user_id, display_name: trust.sellerName, avatar_url: trust.avatarUrl }
            : { id: ticket.user_id, display_name: `Vendedor ${String(ticket.user_id).slice(0, 6)}`, avatar_url: null };

          return (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              event={event}
              seller={seller}
              sellerTrust={trust}
            />
          );
        })}
      </div>
    </div>
  );
}

