"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabaseClient";

const WHATSAPP_URL =
  "https://wa.me/56963528995?text=Hola!%20Estoy%20viendo%20TixSwap%20y%20tengo%20una%20duda%20%F0%9F%91%8B";

export default function WhatsAppFloatingButton() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setIsLoggedIn(Boolean(data?.user));
    }

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const currentPage = useMemo(() => {
    if (typeof window === "undefined") return pathname || "/";
    return `${window.location.pathname}${window.location.search || ""}`;
  }, [pathname]);

  function handleClick() {
    trackEvent("whatsapp_click", {
      page: currentPage,
      is_logged_in: isLoggedIn,
      mode: isHome ? "expanded" : "compact",
    });
  }

  const positionClass = isHome
    ? "bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-5 sm:right-5"
    : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-5";

  const buttonClass = isHome
    ? "inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-emerald-200 bg-white/96 px-2.5 py-2 pr-4 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl sm:gap-3 sm:px-3 sm:py-2.5 sm:pr-5"
    : "inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white/96 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl sm:h-[52px] sm:w-[52px]";

  const logoSize = isHome ? 40 : 38;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={isHome ? "Dudas o consultas, escríbenos por WhatsApp" : "Abrir WhatsApp de soporte"}
      onClick={handleClick}
      className={`group fixed ${positionClass} z-[80] cursor-pointer ${buttonClass}`}
    >
      <span className="inline-flex shrink-0 items-center justify-center">
        <Image
          src="/whatsapp-logo.svg"
          alt=""
          aria-hidden="true"
          width={logoSize}
          height={logoSize}
          className="h-9 w-9 sm:h-10 sm:w-10"
          priority={isHome}
        />
      </span>

      {isHome ? (
        <span className="pr-0.5 text-xs font-semibold leading-tight text-slate-800 sm:text-sm">
          Dudas o consultas, escríbenos
        </span>
      ) : null}
    </a>
  );
}
