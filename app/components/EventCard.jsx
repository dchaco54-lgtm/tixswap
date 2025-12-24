// app/components/EventCard.jsx
import Link from "next/link";

function formatEventDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(iso);
  }
}

export default function EventCard({ event }) {
  const title = event?.title || event?.name || "Evento";
  const dateLabel = formatEventDate(event?.starts_at || event?.date);
  const venue = event?.venue || event?.location || "";
  const city = event?.city || "";
  const imageUrl = event?.image_url || event?.image || event?.imageUrl || "";

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 flex flex-col justify-between">
      <div>
        {/* Imagen del evento (si no existe: placeholder) */}
        <div className="w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center mb-4">
          {imageUrl ? (
            // Usamos <img> (no next/image) para evitar problemas de dominios remotos
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm text-slate-400">Falta cargar imagen</span>
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

        <div className="mt-3 text-sm text-gray-600 space-y-1">
          {dateLabel && (
            <p className="flex items-center gap-2">
              <span>📅</span>
              <span>{dateLabel}</span>
            </p>
          )}
          {(venue || city) && (
            <p className="flex items-center gap-2">
              <span>📍</span>
              <span>
                {venue}
                {venue && city ? " — " : ""}
                {city}
              </span>
            </p>
          )}
        </div>
      </div>

      <Link href={`/events/${event.id}`} className="mt-6 text-blue-600 font-medium hover:underline">
        Ver entradas disponibles →
      </Link>
    </div>
  );
}
