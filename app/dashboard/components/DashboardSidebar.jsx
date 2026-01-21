'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * DashboardSidebar: menú lateral consistente para todas las rutas /dashboard/*
 * 
 * Muestra opciones: Mis datos, Mis compras, Wallet, Vender, etc.
 * Marca activa la ruta actual
 */
export default function DashboardSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { label: 'Mis datos', href: '/dashboard', icon: '👤' },
    { label: 'Mis compras', href: '/dashboard/purchases', icon: '🎟️' },
    { label: 'Mis ventas', href: '/dashboard?tab=mis_ventas', icon: '💰' },
    { label: 'Wallet', href: '/dashboard?tab=wallet', icon: '💳' },
    { label: 'Vender', href: '/sell', icon: '📤' },
    { label: 'Mis tickets', href: '/dashboard/tickets', icon: '🎫' },
    { label: 'Soporte', href: '/dashboard/soporte', icon: '🆘' },
  ];

  const isActive = (href) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <aside className="w-64 bg-white rounded-2xl shadow-sm p-4 h-fit">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Panel</h3>
      
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                block px-4 py-2.5 rounded-lg font-medium text-sm transition
                ${active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
                }
              `}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Link rápido al home */}
      <hr className="my-4 border-slate-200" />
      <Link
        href="/"
        className="block px-4 py-2 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-100 transition"
      >
        🏠 Volver a Inicio
      </Link>
    </aside>
  );
}
