// app/components/Header.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoadingUser(false);
    };
    fetchUser();
  }, []);

  const handleSellClick = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.push(`/login?redirectTo=${encodeURIComponent("/sell")}`);
      return;
    }
    router.push("/sell");
  };

  const handleBuyClick = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.push(`/login?redirectTo=${encodeURIComponent("/events")}`);
      return;
    }
    router.push("/events");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-blue-600">TixSwap</h1>
          <span className="text-sm text-gray-500 hidden sm:block">
            Reventa segura, en un clic
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <button
            onClick={handleBuyClick}
            className="text-gray-700 hover:text-blue-600 font-medium"
          >
            Comprar
          </button>

          <button
            onClick={handleSellClick}
            className="text-gray-700 hover:text-blue-600 font-medium"
          >
            Vender
          </button>

          <a
            href="/#como-funciona"
            className="text-gray-700 hover:text-blue-600 font-medium hidden sm:block"
          >
            Cómo funciona
          </a>

          {!loadingUser && user ? (
            <>
              <span className="text-sm text-gray-600 hidden sm:block">
                Hola, {user.user_metadata?.name || user.email?.split("@")[0]}
              </span>
              <button
                onClick={() => router.push("/account")}
                className="border rounded-full px-4 py-2 text-sm hover:bg-gray-50"
              >
                Ver mi cuenta
              </button>
              <button
                onClick={handleLogout}
                className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            !loadingUser && (
              <button
                onClick={() => router.push(`/login?redirectTo=${encodeURIComponent(pathname || "/")}`)}
                className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90"
              >
                Iniciar sesión
              </button>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
