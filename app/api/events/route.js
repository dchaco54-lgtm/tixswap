import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function columnExists(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

function buildAvailabilityMap(tickets = []) {
  const byEvent = new Map();

  for (const ticket of tickets) {
    const eventId = ticket?.event_id;
    if (!eventId) continue;

    const current = byEvent.get(eventId) || {
      availableTickets: 0,
      minTicketPrice: null,
    };
    const parsedPrice = Number(ticket?.price);
    const price = Number.isFinite(parsedPrice) ? parsedPrice : null;

    current.availableTickets += 1;
    if (price != null) {
      current.minTicketPrice =
        current.minTicketPrice == null
          ? price
          : Math.min(current.minTicketPrice, price);
    }

    byEvent.set(eventId, current);
  }

  return byEvent;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    let q = supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true, nullsFirst: false });

    // Si existe alguna señal de "publicado", filtramos, si no, devolvemos todo
    if (await columnExists(supabase, "events", "status")) {
      // Mostrar estados publicados/activos y también filas sin estado (legacy)
      q = q.or("status.is.null,status.eq.published,status.eq.active");
    } else if (await columnExists(supabase, "events", "is_published")) {
      q = q.eq("is_published", true);
    } else if (await columnExists(supabase, "events", "published")) {
      q = q.eq("published", true);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json(
        { error: "DB error", details: error.message },
        { status: 500 }
      );
    }

    const events = Array.isArray(data) ? data : [];
    const eventIds = events.map((event) => event?.id).filter(Boolean);

    let availabilityMap = new Map();
    if (eventIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("event_id, price")
        .in("event_id", eventIds)
        .in("status", ["active", "available"]);

      if (ticketsError) {
        console.error("[api/events] availability error:", ticketsError);
      } else {
        availabilityMap = buildAvailabilityMap(tickets);
      }
    }

    const eventsWithAvailability = events.map((event) => {
      const availability = availabilityMap.get(event.id) || {
        availableTickets: 0,
        minTicketPrice: null,
      };

      return {
        ...event,
        availableTickets: availability.availableTickets,
        minTicketPrice: availability.minTicketPrice,
      };
    });

    return NextResponse.json(
      { events: eventsWithAvailability },
      {
        headers: {
          "Cache-Control": "no-store, must-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
