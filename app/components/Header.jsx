// app/components/Header.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Error getUser:", error);
      }
      setUser(user || null);
      setLoadingUser(false);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  // 👇 Lógica del botón VENDER
  const handleSellClick = () => {
    if (loadingUser) return; // por si aún carga

    if (user) {
      // Usuario con sesión → directo a vender
      router.push("/sell");
    } else {
      // SIN sesión → ir a login, pero con redirect a /sell
      router.push("/login?redirectTo=/sell");
    }
  };

  const firstName =
    user?.user_metadata?.name?.split(" ")[0] ||
    user?.user_metadata?.full_name?.split(" ")[0] ||
    "Usuario";

  return (
    <header className="border-b bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold text-blue-600">TixSwap</span>
          </Link>
          <span className="hidden sm:inline text-xs text-slate-500">
            Reventa segura, en un clic
          </span>
        </div>

        {/* Navegación principal */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-700">
          <button className="hover:text-blue-600">Comprar</button>
          <button
            className="hover:text-blue-600"
            onClick={handleSellClick}
          >
            Vender
          </button>
          <button className="hover:text-blue-600">Cómo funciona</button>
        </nav>

        {/* Botones de auth: SOLO UNO DE LOS DOS BLOQUES SEGÚN ESTADO */}
        {!loadingUser && (
          <>
            {user ? (
              // Usuario logeado
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-sm text-slate-600">
                  Hola, {firstName}
                </span>
                <Link
                  href="/dashboard"
                  className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Ver mi cuenta
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              // Usuario NO logeado
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="text-sm px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  Crear cuenta
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
