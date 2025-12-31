import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function EventDetailPage({ params }) {
  const eventId = params?.id;

  if (!eventId) notFound();

  const admin = supabaseAdmin();

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) notFound();

  const { data: tickets } = await admin
    .from("tickets")
    .select("id, price, status, title, sector, row, seat, sale_type, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const fmt = (n) => {
    const num = Number(n ?? 0);
    return `CLP ${new Intl.NumberFormat("es-CL").format(Number.isFinite(num) ? num : 0)}`;
  };

  return (
    <div className="min-h-[70vh] px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {event.name || event.title || "Evento"}
            </h1>
            <div className="mt-2 text-slate-600">
              {event.venue || event.location || ""} {event.date ? `• ${event.date}` : ""}
            </div>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Volver
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Entradas disponibles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Si aquí sale vacío, no hay tickets publicados para este evento.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {(tickets || []).length === 0 ? (
              <div className="px-6 py-8 text-slate-600">Aún no hay entradas publicadas.</div>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{t.title || "Entrada"}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {t.sector ? `Sector ${t.sector}` : ""}
                      {t.row ? ` • Fila ${t.row}` : ""}
                      {t.seat ? ` • Asiento ${t.seat}` : ""}
                      {t.sale_type ? ` • ${t.sale_type}` : ""}
                      {t.status ? ` • ${t.status}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="font-bold text-slate-900">{fmt(t.price)}</div>
                    <Link
                      href={`/checkout?ticket=${encodeURIComponent(t.id)}`}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Comprar
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

