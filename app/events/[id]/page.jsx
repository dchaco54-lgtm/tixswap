import events from "../../data/events";
import Link from "next/link";

export default function EventDetail({ params }) {
  const eventId = params.id;

  // Buscar evento por ID
  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          Evento no encontrado
        </h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <Link href="/events" className="text-blue-600 hover:underline">
        ← Volver a eventos
      </Link>

      <h1 className="text-4xl font-bold text-gray-900 mt-4">{event.title}</h1>

      <div className="mt-4 text-gray-700">
        <p>📅 {event.displayDate}</p>
        <p>📍 {event.location}</p>
        <p className="mt-2 font-semibold text-blue-600">
          Categoría: {event.category}
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Entradas disponibles
        </h2>

        {/* Como aún no hay entradas, mostramos el mensaje vacío */}
        <div className="p-6 border rounded-xl text-center text-gray-500">
          No hay entradas disponibles por el momento.
        </div>
      </div>
    </div>
  );
}
