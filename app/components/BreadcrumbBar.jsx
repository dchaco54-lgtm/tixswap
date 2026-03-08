'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * BreadcrumbBar: navegación superior con migas de pan + botones rápidos
 * 
 * Uso:
 * <BreadcrumbBar items={[
 *   { label: 'Mi cuenta', href: '/dashboard' },
 *   { label: 'Mis compras', href: '#' }
 * ]} />
 */
export default function BreadcrumbBar({ items = [] }) {
  const router = useRouter();
  const currentLabel = items[items.length - 1]?.label || "Mi cuenta";

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="px-4 py-3 flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Migas de pan - desktop */}
        <nav className="hidden md:flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Inicio
          </Link>

          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-slate-400">/</span>
              {item.href && item.href !== '#' ? (
                <Link
                  href={item.href}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-slate-600 font-medium">{item.label}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Botones rápidos - móvil y desktop */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Botón volver - móvil */}
          <button
            onClick={() => router.back()}
            className="md:hidden min-h-[44px] px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
            title="Volver a la página anterior"
          >
            ← Volver
          </button>

          {/* Links rápidos - desktop */}
          <div className="hidden md:flex items-center gap-2">
            {items.length > 0 && (
              <Link
                href="/dashboard"
                className="px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium transition"
              >
                Mi cuenta
              </Link>
            )}
            <Link
              href="/events"
              className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
            >
              Eventos
            </Link>
          </div>
        </div>
      </div>

      {/* Breadcrumb compacto - móvil */}
      <nav className="md:hidden border-t border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            Panel
          </span>
          <span className="text-slate-400">/</span>
          <span className="min-w-0 truncate font-semibold text-slate-700">
            {currentLabel}
          </span>
        </div>
      </nav>
    </div>
  );
}
