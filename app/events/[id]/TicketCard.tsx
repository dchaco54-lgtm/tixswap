"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

function formatCLP(value: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

interface TicketCardProps {
  ticket: any;
  seller?: any;
}

export default function TicketCard({ ticket, seller }: TicketCardProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session);
      setLoading(false);
    });

    // Suscribirse a cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleBuyClick = (e: React.MouseEvent) => {
    // No hacer nada si todavía está cargando
    if (loading) {
      e.preventDefault();
      return;
    }

    // Solo redirigir si definitivamente no hay sesión
    if (!session) {
      e.preventDefault();
      window.location.href = '/login?redirect=/checkout/' + ticket.id;
    }
  };

  const price = ticket.price || ticket.price_clp || ticket.amount || null;
  const section = ticket.section || ticket.sector || "";
  const row = ticket.row || ticket.row_label || ticket.fila || "";
  const seat = ticket.seat || ticket.seat_label || ticket.asiento || "";
  const sellerName = seller?.full_name || seller?.email || "Vendedor";

  return (
    <div className="p-5 rounded-2xl border bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">
            {section ? `Sección ${section}` : "Entrada"}
          </div>
          <div className="text-gray-600 mt-1">
            {[row && `Fila ${row}`, seat && `Asiento ${seat}`].filter(Boolean).join(" · ")}
          </div>
          <div className="text-gray-600 mt-2">Vende: {sellerName}</div>
        </div>

        <div className="text-right">
          <div className="text-xl font-bold">{price ? formatCLP(price) : "-"}</div>
          <Link
            href={`/checkout/${ticket.id}`}
            onClick={handleBuyClick}
            className={`inline-block mt-3 px-4 py-2 rounded-xl text-white transition-colors ${
              loading 
                ? 'bg-gray-400 cursor-wait' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Cargando...' : 'Comprar'}
          </Link>
        </div>
      </div>
    </div>
  );
}
