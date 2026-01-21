'use client';

import DashboardSidebar from './components/DashboardSidebar';
import BreadcrumbBar from '@/app/components/BreadcrumbBar';

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
  return (
    <>
      {/* Breadcrumb superior */}
      <BreadcrumbBar items={[{ label: 'Mi cuenta', href: '#' }]} />

      {/* Contenido principal con layout grid */}
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar - desktop only */}
            <div className="hidden md:block">
              <DashboardSidebar />
            </div>

            {/* Contenido principal */}
            <div className="md:col-span-3">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar - mostrar como accordion/modal si es necesario */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2">
        <div className="flex justify-around text-xs">
          <a href="/dashboard" className="py-2 px-2 rounded text-blue-600 font-medium">
            👤 Mi cuenta
          </a>
          <a href="/dashboard/purchases" className="py-2 px-2 rounded text-slate-600 hover:text-blue-600">
            🎟️ Compras
          </a>
          <a href="/sell" className="py-2 px-2 rounded text-slate-600 hover:text-blue-600">
            📤 Vender
          </a>
          <a href="/events" className="py-2 px-2 rounded text-slate-600 hover:text-blue-600">
            🎫 Eventos
          </a>
        </div>
      </div>
    </>
  );
}
