// app/components/Header.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoadingUser(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoadingUser(false);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const displayName = useMemo(() => {
    const name =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "Usuario";
    return String(name).split("@")[0];
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleBuyClick = () => router.push("/events");
  const handleSellClick = () => router.push(user ? "/sell" : "/login");

  // ✅ "Cómo funciona" = SCROLL en home (no redirige). Fuera de home, vuelve a /#como-funciona
  const handleHowItWorksClick = () => {
    const targetId = "como-funciona";

    // Si estamos en Home: scrollear suave
    if (pathname === "/") {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      // fallback: setear hash si el elemento aún no está montado
      window.location.hash = `#${targetId}`;
      return;
    }

    // Si estamos en otra página: ir al home con hash
    router.push(`/#${targetId}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="tix-container py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold text-blue-600">TixSwap</span>
          </Link>
          <span className="hidden sm:inline text-xs text-slate-500">
            Reventa segura, en un clic
          </span>
        </div>

        {/* Navegación */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          <button
            type="button"
            onClick={handleBuyClick}
            className="px-1 py-1 rounded-md hover:text-blue-600 transition-colors"
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={handleSellClick}
            className="px-1 py-1 rounded-md hover:text-blue-600 transition-colors"
          >
            Vender
          </button>
          <button
            type="button"
            onClick={handleHowItWorksClick}
            className="px-1 py-1 rounded-md hover:text-blue-600 transition-colors"
          >
            Cómo funciona
          </button>
        </nav>

        {/* Auth */}
        {!loadingUser && (
          <>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-sm text-slate-600">
                  Hola, {displayName}
                </span>

                <Link href="/dashboard" className="tix-btn-secondary">
                  Ver mi cuenta
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="tix-btn-primary"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="tix-btn-secondary">
                  Iniciar sesión
                </Link>
                <Link href="/register" className="tix-btn-primary">
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
