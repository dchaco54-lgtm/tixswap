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
    <section className="bg-[#4A1E9E]">
      <div className="max-w-6xl mx-auto px-4 py-14 text-center text-white">
        <h2 className="font-display text-3xl md:text-4xl font-bold">¿Cambió tu plan?</h2>
        <p className="mt-3 text-white/90">
          Publica tu entrada en TixSwap y encuentra a alguien que quiera vivir ese evento.
        </p>

        <div className="mt-8">
          <button
            type="button"
            onClick={handleClick}
            className="brand-focus bg-white text-[#4A1E9E] font-semibold px-10 py-4 rounded-2xl shadow-sm hover:bg-[#F2ECFF]"
          >
            Publicar una entrada
          </button>
        </div>
      </div>
    </section>
  );
}
