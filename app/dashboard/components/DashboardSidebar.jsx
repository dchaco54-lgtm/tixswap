"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { USER_TYPES, normalizeRole } from "@/lib/roles";

export default function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, user_type, app_role, role")
        .eq("id", user.id)
        .maybeSingle();

      // Guardamos todo lo que venga (user_type / app_role / role)
      setProfile(data || {});
      setLoading(false);
    };

    load();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const isAdmin = useMemo(() => {
    const raw = profile?.user_type || profile?.app_role || profile?.role || "";
    const normalized = normalizeRole(raw);
    return normalized === USER_TYPES.ADMIN;
  }, [profile]);

  const items = useMemo(() => {
    const base = [
      { label: "Mis datos", href: "/dashboard", icon: "👤" },
      { label: "Mis compras", href: "/dashboard/purchases", icon: "🎟️" },
      { label: "Mis publicaciones", href: "/dashboard/listings", icon: "💰" },
      { label: "Wallet", href: "/dashboard/wallet", icon: "💳" },
      { label: "Vender", href: "/sell", icon: "📤" },
      { label: "Soporte", href: "/dashboard/support", icon: "🆘" },
    ];

    if (isAdmin) {
      // ✅ Aquí está el fix: ir al HUB admin (3 casillas)
      base.push({ label: "Soporte Admin", href: "/admin", icon: "🛠️" });
    }

    return base;
  }, [isAdmin]);

  const handleNavigate = (href) => {
    // /admin a veces conviene hard nav
    if (href === "/admin") {
      window.location.href = "/admin";
      return;
    }
    router.push(href);
  };

  if (loading) {
    return (
      <aside className="w-full md:w-64 shrink-0">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm text-sm text-gray-500">
          Cargando menú...
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-64 shrink-0">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900 mb-3">Panel</div>

        <nav className="flex flex-col gap-1">
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <button
                key={it.href}
                onClick={() => handleNavigate(it.href)}
                className={[
                  "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="w-5 text-left">{it.icon}</span>
                <span className="text-left">{it.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link
            href="/"
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <span className="w-5">🏠</span>
            <span>Volver a Inicio</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

