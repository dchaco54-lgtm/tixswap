'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { normalizeRole, USER_TYPES } from '@/lib/roles';
import { useEffect, useMemo, useState } from 'react';

/**
 * DashboardSidebar: menú lateral consistente para todas las rutas /dashboard/*
 * 
 * Muestra opciones: Mis datos, Mis compras, Wallet, Vender, etc.
 * Incluye opción Admin si el usuario es admin
 * Marca activa la ruta actual
 */
export default function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = useMemo(() => {
    if (!profile) return false;
    return normalizeRole(profile?.user_type) === USER_TYPES.ADMIN;
  }, [profile]);

  const menuItems = useMemo(() => {
    const base = [
      { label: 'Mis datos', href: '/dashboard', icon: '👤' },
      { label: 'Mis compras', href: '/dashboard/purchases', icon: '🎟️' },
      { label: 'Mis publicaciones', href: '/dashboard/publicaciones', icon: '💰' },
      { label: 'Wallet', href: '/dashboard/wallet', icon: '💳' },
      { label: 'Vender', href: '/sell', icon: '📤' },
      { label: 'Soporte', href: '/dashboard/soporte', icon: '🆘' },
    ];

    // ✅ En vez de mandarte directo a /admin/soporte (solo tickets),
    // te mandamos al HUB /admin (Usuarios / Eventos / Soporte)
    if (isAdmin) {
      base.push({ label: 'Admin', href: '/admin', icon: '🛠️' });
    }

    return base;
  }, [isAdmin]);

  const isActive = (href) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname.startsWith(href)) return true;
    return false;
  };

  const handleNavigate = (href) => {
    // Para rutas admin, forzamos navegación full (evita rarezas con client routing en algunos casos)
    if (href.startsWith('/admin')) {
      window.location.href = href;
      return;
    }
    router.push(href);
  };

  if (!mounted) {
    return (
      <aside className="w-64 bg-white rounded-2xl shadow-sm p-4 h-fit">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Panel</h3>
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white rounded-2xl shadow-sm p-4 h-fit">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Panel</h3>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={`
                w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition
                ${active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
                }
              `}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <hr className="my-4 border-slate-200" />
      <button
        onClick={() => handleNavigate('/')}
        className="w-full text-left px-4 py-2 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-100 transition"
      >
        🏠 Volver a Inicio
      </button>
    </aside>
  );
}

