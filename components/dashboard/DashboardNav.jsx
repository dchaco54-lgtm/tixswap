"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import { normalizeRole, USER_TYPES } from "@/lib/roles";

function getMenuItems(isAdmin) {
  const items = [
    { label: "Mis datos", href: "/dashboard", icon: "👤", description: "Perfil y datos personales" },
    { label: "Mis compras", href: "/dashboard/purchases", icon: "🎟️", description: "Entradas compradas y órdenes" },
    { label: "Mis publicaciones", href: "/dashboard/publicaciones", icon: "💰", description: "Tus entradas publicadas" },
    { label: "Mis calificaciones", href: "/dashboard/calificaciones", icon: "⭐", description: "Tu reputación en TixSwap" },
    { label: "Wallet", href: "/dashboard/wallet", icon: "💳", description: "Datos bancarios y pagos" },
    { label: "Vender", href: "/sell", icon: "📤", description: "Publica una nueva entrada" },
    { label: "Soporte", href: "/dashboard/tickets", icon: "🆘", description: "Tickets y conversación con soporte" },
  ];

  if (isAdmin) {
    items.push({
      label: "Admin",
      href: "/admin",
      icon: "🛠️",
      description: "Usuarios, eventos y soporte",
    });
  }

  return items;
}

function getSectionMeta(pathname) {
  if (pathname === "/dashboard") {
    return { title: "Mis datos", subtitle: "Perfil, contacto y configuración" };
  }

  if (pathname.startsWith("/dashboard/purchases")) {
    return { title: "Mis compras", subtitle: "Historial, órdenes y seguimiento" };
  }
  if (pathname.startsWith("/dashboard/publicaciones")) {
    return { title: "Mis publicaciones", subtitle: "Estado y gestión de tus publicaciones" };
  }
  if (pathname.startsWith("/dashboard/publications")) {
    return { title: "Detalle publicación", subtitle: "Estado, chat y acciones de la venta" };
  }
  if (pathname.startsWith("/dashboard/calificaciones")) {
    return { title: "Mis calificaciones", subtitle: "Reputación y comentarios" };
  }
  if (pathname.startsWith("/dashboard/wallet")) {
    return { title: "Wallet", subtitle: "Cuenta bancaria y pagos" };
  }
  if (pathname.startsWith("/dashboard/tickets") || pathname.startsWith("/dashboard/soporte")) {
    return { title: "Soporte", subtitle: "Tickets, mensajes y adjuntos" };
  }
  if (pathname.startsWith("/dashboard/chat")) {
    return { title: "Chat", subtitle: "Conversación sobre tu orden" };
  }
  if (pathname.startsWith("/sell")) {
    return { title: "Vender", subtitle: "Publica y administra tu ticket" };
  }

  return { title: "Mi cuenta", subtitle: "Panel principal de TixSwap" };
}

function MenuButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.href)}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-lg ${
          active ? "bg-white/15" : "bg-slate-100"
        }`}
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{item.label}</span>
        <span className={`mt-0.5 block text-xs ${active ? "text-blue-100" : "text-slate-500"}`}>
          {item.description}
        </span>
      </span>
    </button>
  );
}

export default function DashboardNav({ currentPath = "" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);

  const resolvedPath = currentPath || pathname || "/dashboard";
  const isAdmin = useMemo(() => {
    if (!profile) return false;
    return normalizeRole(profile?.user_type) === USER_TYPES.ADMIN;
  }, [profile]);
  const menuItems = useMemo(() => getMenuItems(isAdmin), [isAdmin]);
  const section = useMemo(
    () => getSectionMeta(resolvedPath),
    [resolvedPath]
  );

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isActive = (href) => {
    if (href === "/dashboard" && resolvedPath === "/dashboard") return true;
    if (href !== "/dashboard" && resolvedPath.startsWith(href)) return true;
    return false;
  };

  const handleNavigate = (href) => {
    setOpen(false);

    if (href.startsWith("/admin")) {
      window.location.href = href;
      return;
    }

    router.push(href);
  };

  return (
    <>
      <div className="lg:hidden">
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                Panel
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{section.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="tix-btn-secondary min-h-[44px] shrink-0 gap-2 px-4"
            >
              <span className="text-base">☰</span>
              <span>Menú</span>
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              Mi cuenta
            </span>
            {section.title !== "Mi cuenta" ? <span>/</span> : null}
            {section.title !== "Mi cuenta" ? (
              <span className="font-semibold text-blue-700">{section.title}</span>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="hidden lg:flex lg:sticky lg:top-[124px] lg:max-h-[calc(100dvh-148px)] lg:min-w-0 lg:flex-col lg:overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 p-4 shadow-soft">
        <div className="px-2 pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
            Panel
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Mi cuenta</h2>
          <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
          {menuItems.map((item) => (
            <MenuButton
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onClick={handleNavigate}
            />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => handleNavigate("/")}
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <span>🏠</span>
          <span>Volver a inicio</span>
        </button>
      </aside>

      {open ? (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-[80] flex w-[min(88vw,340px)] max-w-full flex-col border-r border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 pb-4 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                    TixSwap
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">Menú del panel</div>
                  <div className="mt-1 text-sm text-slate-500">{section.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Cerrar menú"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <MenuButton
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onClick={handleNavigate}
                  />
                ))}
              </nav>
            </div>

            <div className="border-t border-slate-200 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <button
                type="button"
                onClick={() => handleNavigate("/")}
                className="tix-btn-secondary min-h-[48px] w-full gap-2"
              >
                <span>🏠</span>
                <span>Volver a inicio</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
