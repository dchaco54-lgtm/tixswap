// app/components/Footer.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Footer() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setUser(data?.user || null);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const goProtected = async (target) => {
    const { data } = await supabase.auth.getUser();
    const current = data?.user || user;

    if (current) {
      router.push(target);
      return;
    }

    router.push(`/login?redirectTo=${encodeURIComponent(target)}`);
  };

  const Item = ({ children, onClick, href, muted = false }) => {
    const common =
      "block text-left text-sm transition-colors " +
      (muted
        ? "text-gray-500 cursor-default"
        : "text-gray-300 hover:text-white");

    if (href) {
      return (
        <a href={href} className={common}>
          {children}
        </a>
      );
    }

    if (muted) {
      return <span className={common}>{children}</span>;
    }

    return (
      <button type="button" onClick={onClick} className={common}>
        {children}
      </button>
    );
  };

  return (
    <footer className="bg-[#0c0f19] text-gray-300 py-12 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
        <div>
          <h3 className="font-bold text-lg mb-3 text-white">TixSwap</h3>
          <p className="text-sm text-gray-400">Reventa segura en un clic.</p>
        </div>

        <div>
          <h4 className="font-bold mb-3 text-white">Plataforma</h4>
          <div className="space-y-2">
            <Item onClick={() => goProtected("/events")}>Comprar</Item>
            <Item onClick={() => goProtected("/sell")}>Vender</Item>
            <Item onClick={() => router.push("/how-it-works")}>
              Cómo funciona
            </Item>
          </div>
        </div>

        <div>
          <h4 className="font-bold mb-3 text-white">Soporte</h4>
          <div className="space-y-2">
            <Item onClick={() => goProtected("/dashboard?section=support")}>
              Centro de ayuda
            </Item>

            <Item href="mailto:soporte@tixswap.cl">Contacto</Item>

            <Item onClick={() => router.push("/disputes")}>Disputas</Item>
          </div>
        </div>

        <div>
          <h4 className="font-bold mb-3 text-white">Legal</h4>
          <div className="space-y-2">
            <Item onClick={() => router.push("/legal/privacy")}>Privacidad</Item>
            <Item onClick={() => router.push("/legal/security")}>
              Seguridad y antifraude
            </Item>
            <Item onClick={() => router.push("/legal/terms")}>Términos y condiciones</Item>
          </div>
        </div>
      </div>

      <p className="text-center mt-10 text-gray-500 text-sm">
        © 2026 TixSwap. Todos los derechos reservados.
      </p>
    </footer>
  );
}
