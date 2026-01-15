// app/components/CTA.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CTA() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    load();
  }, []);

  const handleClick = () => {
    // UX ideal:
    // - si está logeado => vender (acción inmediata)
    // - si no => registrarse (conversión)
    if (user) router.push("/sell");
    else router.push("/register");
  };

  return (
    <section className="bg-blue-600">
      <div className="max-w-6xl mx-auto px-4 py-14 text-center text-white">
        <h2 className="text-3xl md:text-4xl font-bold">¿Tienes entradas para vender?</h2>
        <p className="mt-3 text-white/90">
          Únete a miles que confían en TixSwap para intercambiar entradas.
        </p>

        <div className="mt-8">
          <button
            onClick={handleClick}
            className="bg-white text-blue-600 font-semibold px-10 py-4 rounded-2xl shadow-sm hover:opacity-95"
          >
            Comenzar ahora
          </button>
        </div>
      </div>
    </section>
  );
}
