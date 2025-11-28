export default function EventCard({ event }) {
  return (
    <div className="bg-white rounded-xl shadow-soft overflow-hidden border hover-pop">
      <div className="card-gradient h-40 flex items-center justify-center text-white font-bold text-lg">
        {event.category}
      </div>

      <div className="p-5">
        <h3 className="font-semibold">{event.title}</h3>

        <p className="text-gray-600 mt-2">
          📅 {event.date} <br />
          📍 {event.location}
        </p>

        <a className="text-blue-600 text-sm mt-4 inline-block cursor-pointer">
          Ver entradas disponibles →
        </a>
      </div>
    </div>
  );
}
