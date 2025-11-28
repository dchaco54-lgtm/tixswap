import EventCard from "./EventCard";

export default function EventGrid({ events }) {
  return (
    <section className="px-6 py-20">
      <h2 className="text-3xl font-bold mb-6">Eventos destacados</h2>

      <div className="grid md:grid-cols-3 gap-8">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
