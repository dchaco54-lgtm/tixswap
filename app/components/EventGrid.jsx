// app/components/EventGrid.jsx
import Link from "next/link";
import EventCard from "./EventCard";

export default function EventGrid({ title = "Eventos destacados", events = [] }) {
  const topEvents = Array.isArray(events) ? events.slice(0, 6) : [];

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold text-[#1A1333] md:text-3xl">{title}</h2>

        {/* (Imagen 3) En rojo: link a todos los eventos */}
        <Link
          href="/events"
          className="brand-focus rounded text-sm font-semibold text-[#4A1E9E] hover:underline"
        >
          Todos los eventos →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {topEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
