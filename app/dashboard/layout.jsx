'use client';

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import BreadcrumbBar from '@/app/components/BreadcrumbBar';
import DashboardNav from "@/components/dashboard/DashboardNav";

/**
 * Layout para todas las rutas bajo /dashboard/*
 * 
 * Proporciona estructura consistente:
 * - BreadcrumbBar en la parte superior
 * - Sidebar en desktop
 * - Contenido en la derecha
 * 
 * Subpáginas como /dashboard/purchases usan este layout automáticamente
 */
export default function DashboardLayout({ children }) {
  const pathname = usePathname();

  const breadcrumbItems = useMemo(() => {
    if (pathname === "/dashboard") {
      return [{ label: "Mi cuenta", href: "#" }];
    }
    if (pathname.startsWith("/dashboard/purchases")) {
      return [
        { label: "Mi cuenta", href: "/dashboard" },
        { label: "Mis compras", href: "#" },
      ];
    }
    if (pathname.startsWith("/dashboard/publicaciones")) {
      return [
        { label: "Mi cuenta", href: "/dashboard" },
        { label: "Mis publicaciones", href: "#" },
      ];
    }
    if (pathname.startsWith("/dashboard/publications")) {
      return [
        { label: "Mi cuenta", href: "/dashboard" },
        { label: "Detalle publicación", href: "#" },
      ];
    }
    if (pathname.startsWith("/dashboard/calificaciones")) {
      return [
        { label: "Mi cuenta", href: "/dashboard" },
        { label: "Mis calificaciones", href: "#" },
      ];
    }
    if (pathname.startsWith("/dashboard/wallet")) {
      return [
        { label: "Mi cuenta", href: "/dashboard" },
        { label: "Wallet", href: "#" },
      ];
    }
    if (pathname.startsWith("/dashboard/tickets") || pathname.startsWith("/dashboard/soporte")) {
      return [
        { label: "Mi cuenta", href: "/dashboard" },
        { label: "Soporte", href: "#" },
      ];
    }
    return [{ label: "Mi cuenta", href: "#" }];
  }, [pathname]);

  return (
    <>
      <BreadcrumbBar items={breadcrumbItems} />

      <div className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6 lg:py-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
            <div className="min-w-0">
              <DashboardNav currentPath={pathname} />
            </div>

            <div className="min-w-0 max-w-full">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
