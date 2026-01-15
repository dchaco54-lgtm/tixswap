"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function MainHeader() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) {
        setUser(data.user);
      }
      setLoadingUser(false);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/"); // te deja en la home
  };

  const fullName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Mi cuenta";

  return (
    <header className="w-full border-b border-slate-100 bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo / nombre */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
        >
          <span className="text-lg font-semibold text-slate-900">
            TixSwap
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
            Beta
          </span>
        </button>

        {/* Acciones derecha */}
        <div className="flex items-center gap-2">
          {/* Más adelante acá podrías poner links: Ver eventos / Vender entrada */}

          {loadingUser ? (
            <span className="text-xs text-slate-400">Cargando…</span>
          ) : user ? (
            // Usuario logueado
            <>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              >
                Ver mi cuenta
              </button>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            // Invitado
            <>
              <button
                onClick={() => router.push("/login")}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => router.push("/register")}
                className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
