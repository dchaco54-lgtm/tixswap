"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";

import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import EventGrid from "./components/EventGrid";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // Cargar usuario logeado (si existe)
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user ?? null);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  const featuredEvents = [
    {
      id: 1,
      title: "My Chemical Romance",
      category: "Rock",
      date: "29 de enero de 2026",
      location: "Estadio Bicentenario La Florida",
    },
    {
      id: 2,
      title: "Chayanne",
      category: "Pop Latino",
      date: "7 de febrero de 2026",
      location: "Concepción",
    },
    {
      id: 3,
      title: "Doja Cat",
      category: "Hip Hop",
      date: "10 de febrero de 2026",
      location: "Movistar Arena",
    },
  ];

  const displayName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Usuario";

  return (
    <main className="relative">
      {/* Barra flotante arriba a la derecha para navegar entre home / cuenta */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {user ? (
          <>
            <span className="hidden sm:inline text-sm text-slate-700">
              Hola, {displayName}
            </span>
            <Link
              href="/dashboard"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
            >
              Ver mi cuenta
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            >
              Crear cuenta
            </Link>
          </>
        )}
      </div>

      {/* Contenido principal de la landing */}
      <Header />
      <Hero />
      <Categories />
      <EventGrid events={featuredEvents} />
      <CTA />
      <Footer />
    </main>
  );
}

