"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TicketPublicClient({ ticketId }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);

  const onBuy = async () => {
    if (!ticketId) return;
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data?.session?.user;
      if (!hasSession) {
        router.push(
          `/login?redirectTo=${encodeURIComponent(`/checkout/${ticketId}`)}`
        );
        return;
      }

      router.push(`/checkout/${ticketId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
    >
      {loading ? "Redirigiendo..." : "Comprar"}
    </button>
  );
}
