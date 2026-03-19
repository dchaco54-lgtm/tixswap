"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabaseClient";

const WHATSAPP_URL =
  "https://wa.me/56963528995?text=Hola!%20Estoy%20viendo%20TixSwap%20y%20tengo%20una%20duda%20%F0%9F%91%8B";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
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
    });
  }

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Dudas o consultas, escríbenos por WhatsApp"
      onClick={handleClick}
      className="group fixed bottom-5 right-5 z-[90] inline-flex cursor-pointer items-center gap-3 rounded-full border border-emerald-200 bg-white px-3 py-3 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md">
        <WhatsAppIcon />
      </span>

      <span className="pr-1 text-sm font-semibold leading-none text-slate-800">
        <span className="sm:hidden">Escríbenos</span>
        <span className="hidden sm:inline">
          Dudas o consultas, escríbenos 😉
        </span>
      </span>
    </a>
  );
}
