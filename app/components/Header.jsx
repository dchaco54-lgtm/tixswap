// app/components/Header.jsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user || null);
      setLoadingUser(false);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const userName =
    user?.user_metadata?.name || user?.user_metadata?.full_name || "Usuario";

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/"
            className="text-xl font-semibold text-blue-600 tracking-tight"
          >
            TixSwap
          </Link>
          <span className="hidden sm:inline text-xs text-slate-500">
            Reventa segura, en un clic
          </span>
        </div>

        {/* Menú centro (se oculta en móviles para no chocar) */}
        <nav className="hidden md:flex items-center gap-6 mx-auto text-sm text-slate-700">
          <Link href="/#comprar" className="hover:text-blue-600">
            Comprar
          </Link>
          <Link href="/#vender" className="hover:text-blue-600">
            Vender
          </Link>
          <Link href="/#como-funciona" className="hover:text-blue-600">
            Cómo funciona
          </Link>
        </nav>

        {/* Zona derecha: login / cuenta */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!loadingUser && !user && (
            <>
              <Link
                href="/login"
                className="text-sm px-3 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="text-sm px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Crear cuenta
              </Link>
            </>
          )}

          {!loadingUser && user && (
            <>
              <span className="hidden sm:inline text-sm text-slate-700">
                Hola, {userName}
              </span>
              <Link
                href="/dashboard"
                className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}


