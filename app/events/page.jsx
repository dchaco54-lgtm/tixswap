import events from "../data/events";
import Link from "next/link";

export default function EventsPage() {
  // Ordenar por fecha real
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Todos los eventos
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedEvents.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="block p-6 rounded-xl shadow-sm border hover:shadow-md transition"
          >
            <div className="text-sm text-blue-600 font-semibold mb-2">
              {event.category}
            </div>

            <h2 className="text-xl font-semibold text-gray-900">
              {event.title}
            </h2>

            <div className="mt-2 text-gray-600">
              📅 {event.displayDate}
              <br />
              📍 {event.location}
            </div>

            <div className="mt-4 text-blue-600 font-medium">
              Ver detalles →
            </div>
          </Link>
        ))}
      </div>

      {sortedEvents.length === 0 && (
        <p className="text-center text-gray-500 mt-10">
          No hay eventos disponibles.
        </p>
      )}
    </div>
  );
}
