// app/components/Header.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MobileNavMenu from "./MobileNavMenu";
import NotificationBell from "@/components/NotificationBell";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profileName, setProfileName] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoadingUser(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setProfileName(null);
      setLoadingUser(false);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setProfileName(null);
      return () => {
        active = false;
      };
    }

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("[Header] Error cargando perfil:", error);
        setProfileName(null);
        return;
      }

      setProfileName(data?.full_name ?? null);
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const displayName = useMemo(() => {
    const name =
      profileName ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "Usuario";

    const str = String(name || "");
    if (name === user?.email && str.includes("@")) return str.split("@")[0];
    return str || "Usuario";
  }, [profileName, user]);

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
    <header className="sticky top-0 z-50 border-b border-[#E4D9FF] bg-white/90 backdrop-blur">
      <div className="tix-container flex items-center justify-between gap-3 py-3">
        {/* Logo */}
        <div className="flex min-w-0 items-center">
          <Link href="/" className="brand-focus rounded-md" aria-label="TixSwap — inicio">
            <Image
              src="/brand/tixswap-logo-color.png"
              alt="TixSwap"
              width={2064}
              height={543}
              priority
              sizes="(max-width: 640px) 112px, 132px"
              className="h-auto w-28 sm:w-[132px]"
            />
          </Link>
        </div>

        {/* Navegación */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          <button
            type="button"
            onClick={handleBuyClick}
            className="brand-focus px-1 py-1 rounded-md hover:text-[#7B3FF2] transition-colors"
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={handleSellClick}
            className="brand-focus px-1 py-1 rounded-md hover:text-[#7B3FF2] transition-colors"
          >
            Vender
          </button>
          <button
            type="button"
            onClick={handleHowItWorksClick}
            className="brand-focus px-1 py-1 rounded-md hover:text-[#7B3FF2] transition-colors"
          >
            Cómo funciona
          </button>
        </nav>

        {/* Auth */}
        {!loadingUser && (
          <div className="flex min-w-0 items-center gap-2">
            <>
              {user ? (
                <>
                  <span className="hidden sm:inline text-sm text-slate-600">
                    Hola, {displayName}
                  </span>

                  <NotificationBell userId={user?.id} />

                  <span className="hidden md:inline-flex">
                    <Link href="/dashboard" className="tix-btn-secondary">
                      Ver mi cuenta
                    </Link>
                  </span>

                  <span className="hidden sm:inline-flex">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="tix-btn-primary"
                    >
                      Cerrar sesión
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline-flex">
                    <Link href="/login" className="tix-btn-secondary">
                      Iniciar sesión
                    </Link>
                  </span>
                  <span className="hidden sm:inline-flex">
                    <Link href="/register" className="tix-btn-primary">
                      Crear cuenta
                    </Link>
                  </span>
                </>
              )}
            </>

            {/* Mobile menu */}
            <MobileNavMenu
              user={user}
              displayName={displayName}
              onLogout={handleLogout}
            />
          </div>
        )}
      </div>
    </header>
  );
}
