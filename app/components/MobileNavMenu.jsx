'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * MobileNavMenu: menú hamburguesa para móvil
 * 
 * Aparece solo en móvil (<md breakpoint)
 * Incluye: Comprar, Vender, Cómo funciona, Mi cuenta (si logeado), Logout
 */
export default function MobileNavMenu({ user, displayName, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleNavClick = (callback) => {
    setIsOpen(false);
    if (callback) callback();
  };

  const handleBuyClick = () => {
    handleNavClick(() => router.push('/events'));
  };

  const handleSellClick = () => {
    handleNavClick(() => router.push(user ? '/sell' : '/login'));
  };

  const handleHowItWorksClick = () => {
    handleNavClick(() => {
      if (typeof window !== 'undefined') {
        const targetId = 'como-funciona';
        if (window.location.pathname === '/') {
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          window.location.hash = `#${targetId}`;
        } else {
          router.push(`/#${targetId}`);
        }
      }
    });
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await onLogout();
  };

  if (!isOpen) {
    // Solo mostrar botón hamburguesa
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
        aria-label="Menú"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    );
  }

  // Menú abierto - drawer/modal
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Menu drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-64 bg-white z-50 md:hidden shadow-lg overflow-y-auto">
        {/* Header del drawer */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <span className="font-bold text-lg text-slate-900">Menú</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
            aria-label="Cerrar menú"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Opciones de navegación */}
        <nav className="p-4 space-y-2">
          <button
            onClick={handleBuyClick}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-medium transition"
          >
            🎟️ Comprar
          </button>
          <button
            onClick={handleSellClick}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-medium transition"
          >
            📤 Vender
          </button>
          <button
            onClick={handleHowItWorksClick}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-medium transition"
          >
            ℹ️ Cómo funciona
          </button>

          <hr className="my-2 border-slate-200" />

          {user ? (
            <>
              <div className="px-4 py-2 text-xs text-slate-500">
                Hola, <span className="font-semibold text-slate-700">{displayName}</span>
              </div>
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="block w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-medium transition"
              >
                👤 Mi cuenta
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-600 font-medium transition"
              >
                🚪 Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full text-left px-4 py-3 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                onClick={() => setIsOpen(false)}
                className="block w-full text-left px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition hover:bg-blue-700"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
