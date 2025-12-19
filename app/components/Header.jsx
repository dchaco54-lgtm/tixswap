// app/components/Header.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function prettifyFirstName(raw) {
  if (!raw) return "Usuario";

  // limpia cosas típicas de usernames/correos
  const cleaned = String(raw)
    .replace(/[@].*$/, "") // por si le pasan un correo
    .replace(/[_\.]+/g, " ")
    .replace(/\d+/g, " ")
    .trim();

  const first = cleaned.split(/\s+/)[0] || "Usuario";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // displayName final (nombre bonito)
  const displayName = useMemo(() => {
    const metaName =
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.fullName;

    // prioridad: metadata (lo que tú elegiste al registrar)
    if (metaName) return prettifyFirstName(metaName);

    // fallback: si no hay metadata, intentamos con email/username
    const emailPrefix = user?.email?.split("@")?.[0];
    if (emailPrefix) return prettifyFirstName(emailPrefix);

    return "Usuario";
  }, [user]);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) console.error("Error getUser:", error);
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

  // Comprar => /events (con guard)
  const handleBuyClick = () => {
    if (loadingUser) return;

    if (user) router.push("/events");
    else router.push("/login?redirectTo=/events");
  };

  // Vender => /sell (con guard)
  const handleSellClick = () => {
    if (loadingUser) return;

    if (user) router.push("/sell");
    else router.push("/login?redirectTo=/sell");
  };

  // Cómo funciona => anchor en home (sin guard)
  const handleHowItWorksClick = () => {
    // si ya estás en home, intenta scroll suave
    if (pathname === "/" && typeof window !== "undefined") {
      const el = document.getElementById("como-funciona");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    // si no, navega al anchor
    router.push("/#como-funciona");
  };

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

        {/* Navegación principal (formato bonito, consistente) */}
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

                <Link
                  href="/dashboard"
                  className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Ver mi cuenta
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
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
