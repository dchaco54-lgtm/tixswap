"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RedirectCountdown({ to="/dashboard/purchases", seconds=5 }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(t);
          router.replace(to);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [router, to]);

  return <p className="text-sm text-slate-600">Redirigiendo a Mis compras en {left}s…</p>;
}
