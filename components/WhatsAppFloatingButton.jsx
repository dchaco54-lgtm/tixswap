"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabaseClient";

const WHATSAPP_URL =
  "https://wa.me/56963528995?text=Hola!%20Estoy%20viendo%20TixSwap%20y%20tengo%20una%20duda%20%F0%9F%91%8B";

function WhatsAppIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="#25D366"
        d="M19.1 17.4c-.3-.2-1.8-.9-2-.9-.3-.1-.4-.2-.6.2-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6.1-1.7-.9-2.8-1.7-4-3.8-.3-.4.3-.4.8-1.4.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.5.1.2 1.8 2.8 4.5 3.9 1.7.7 2.3.8 3.1.7.5-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.5-.3Z"
      />
      <path
        fill="#25D366"
        d="M16 3.2c-7 0-12.7 5.7-12.7 12.7 0 2.2.6 4.4 1.7 6.2L3.2 28.8l6.9-1.8c1.8 1 3.8 1.5 5.9 1.5 7 0 12.7-5.7 12.7-12.7S23 3.2 16 3.2Zm0 22.9c-1.9 0-3.8-.5-5.3-1.5l-.4-.2-4.1 1.1 1.1-4-.3-.4c-1.1-1.6-1.7-3.6-1.7-5.5 0-5.9 4.8-10.8 10.8-10.8 2.9 0 5.6 1.1 7.7 3.2 2 2 3.2 4.8 3.2 7.7 0 5.9-4.9 10.8-10.8 10.8Z"
      />
    </svg>
  );
}

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

  const bubbleClass = isHome
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md sm:h-10 sm:w-10"
    : "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md";

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={isHome ? "Dudas o consultas, escríbenos por WhatsApp" : "Abrir WhatsApp de soporte"}
      onClick={handleClick}
      className={`group fixed ${positionClass} z-[80] cursor-pointer ${buttonClass}`}
    >
      <span className={bubbleClass}>
        <WhatsAppIcon className={isHome ? "h-5 w-5 sm:h-6 sm:w-6" : "h-5 w-5"} />
      </span>

      {isHome ? (
        <span className="pr-0.5 text-xs font-semibold leading-tight text-slate-800 sm:text-sm">
          Dudas o consultas, escríbenos
        </span>
      ) : null}
    </a>
  );
}
