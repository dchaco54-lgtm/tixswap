"use client";

import Link from "next/link";

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function EventsClient({ events }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="block rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition"
        >
          {/* ✅ Imagen del evento */}
          {event.image_url ? (
            <div className="mb-3 overflow-hidden rounded-xl border bg-gray-50">
              <img
                src={event.image_url}
                alt={event.name || "Evento"}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          <h3 className="text-lg font-semibold">{event.name}</h3>
          <p className="text-sm text-gray-600">
            {formatDate(event.date)} · {event.time || "--"} · {event.venue || "--"},{" "}
            {event.city || "--"}
          </p>
        </Link>
      ))}
    </div>
  );
}
