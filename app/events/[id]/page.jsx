// app/events/[id]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function formatDateTime(iso) {
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

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export default function EventDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const id = params?.id;

  const [userChecked, setUserChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");

  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortBy, setSortBy] = useState("price_asc");

  // Auth guard
  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(pathname || `/events/${id}`)}`);
        return;
      }
      setUserChecked(true);
    };
    guard();
  }, [router, pathname, id]);

  // Load event + tickets
  useEffect(() => {
    if (!userChecked || !id) return;

    const load = async () => {
      setLoading(true);
      setError("");

      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (evErr) {
        setError("No pudimos cargar el evento.");
        setEvent(null);
        setTickets([]);
        setLoading(false);
        return;
      }

      setEvent(ev);

      const { data: tks, error: tkErr } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", id)
        .order("price", { ascending: true });

      if (tkErr) {
        setTickets([]);
      } else {
        setTickets(Array.isArray(tks) ? tks : []);
      }

      setLoading(false);
    };

    load();
  }, [userChecked, id]);

  const sectors = useMemo(() => {
    const set = new Set();
    (tickets || []).forEach((t) => {
      if (t?.sector) set.add(t.sector);
    });
    return ["all", ...Array.from(set)];
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    let list = [...(tickets || [])];

    if (sectorFilter !== "all") {
      list = list.filter((t) => t?.sector === sectorFilter);
    }

    if (sortBy === "price_asc") {
      list.sort((a, b) => (toNumber(a?.price) ?? 0) - (toNumber(b?.price) ?? 0));
    }
    if (sortBy === "price_desc") {
      list.sort((a, b) => (toNumber(b?.price) ?? 0) - (toNumber(a?.price) ?? 0));
    }

    return list;
  }, [tickets, sectorFilter, sortBy]);

  if (!userChecked) {
    return <div className="max-w-6xl mx-auto px-4 py-16 text-slate-600">Cargando…</div>;
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-16 text-slate-600">Cargando evento…</div>;
  }

  if (error || !event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16">
        <Link href="/events" className="text-sm text-slate-600 hover:text-blue-600">
          ← Volver a eventos
        </Link>
        <p className="mt-6 text-slate-700">{error || "Evento no encontrado."}</p>
      </div>
    );
  }

  const title = event?.title || event?.name || "Evento";
  const dateLabel = formatDateTime(event?.starts_at || event?.date);
  const venue = event?.venue || event?.location || "";
  const city = event?.city || "";
  const imageUrl = event?.image_url || event?.image || event?.imageUrl || "";

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/events" className="text-sm text-slate-600 hover:text-blue-600">
        ← Volver a eventos
      </Link>

      <div className="mt-6 bg-white border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {/* Imagen del evento (si no existe: placeholder) */}
          <div className="w-full h-52 md:h-44 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center mb-5">
            {imageUrl ? (
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

          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <div className="mt-3 text-slate-700 space-y-1">
            {dateLabel && <p>📅 {dateLabel}</p>}
            {(venue || city) && (
              <p>
                📍 {venue}
                {venue && city ? " · " : ""}
                {city}
              </p>
            )}
          </div>
        </div>

        {/* ✅ Caja compacta (mitad) + clamp 2 líneas */}
        <div className="hidden md:flex w-full max-w-[420px] justify-end">
          <div className="bg-slate-50 border rounded-xl px-5 py-4 text-sm text-slate-700 w-full">
            <p className="font-semibold">Reventa segura en TixSwap</p>
            <p
              className="mt-1 leading-snug"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              Pagas dentro de TixSwap y tu plata queda protegida: validamos el ticket y liberamos el pago al vendedor
              solo cuando todo está OK.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Entradas disponibles</h2>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="border rounded-xl px-4 py-2"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "Todos los sectores" : s}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border rounded-xl px-4 py-2"
              >
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="text-slate-600">Aún no hay entradas publicadas para este evento.</div>
            ) : (
              filteredTickets.map((t) => (
                <div
                  key={t.id}
                  className="border rounded-xl p-5 bg-white shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {t?.title || "Entrada"}
                      {t?.sector ? ` · ${t.sector}` : ""}
                      {t?.row ? ` · Fila ${t.row}` : ""}
                      {t?.seat ? `, asiento ${t.seat}` : ""}
                    </p>

                    {t?.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}

                    {t?.seller_name && (
                      <p className="mt-1 text-xs text-slate-500">Publicado por {t.seller_name}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-green-700">
                      ${Number(t?.price || 0).toLocaleString("es-CL")}
                    </p>
                    <button
                      className="mt-2 bg-green-600 text-white px-4 py-2 rounded-xl font-semibold hover:opacity-90"
                      onClick={() => alert("Compra (MVP): próximamente")}
                    >
                      Comprar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Cómo funciona TixSwap</h3>
            <ol className="mt-3 text-sm text-slate-700 space-y-2 list-decimal list-inside">
              <li>El vendedor publica y sube su ticket (PDF). TixSwap valida formato y evita duplicados.</li>
              <li>
                Compras dentro de TixSwap: tu pago queda protegido mientras se coordina la entrega (si es nominada, se
                coordina por el chat).
              </li>
              <li>
                Cuando el ticket está OK para usar, liberamos el pago al vendedor. Si hay un problema validado,
                gestionamos el reembolso.
              </li>
            </ol>
          </div>

          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Recomendaciones para evitar estafas</h3>
            <ul className="mt-3 text-sm text-slate-700 space-y-2 list-disc list-inside">
              <li>Paga siempre dentro de TixSwap (nunca transferencia por fuera).</li>
              <li>Revisa bien sector/fila/asiento y que coincida con el evento y la fecha.</li>
              <li>Si es nominada, coordina solo por el chat de TixSwap y deja todo registrado ahí.</li>
              <li>Desconfía de precios demasiado bajos o vendedores que apuren “ya ya ya”.</li>
              <li>No compartas datos sensibles fuera del proceso (clave, códigos, etc.).</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
