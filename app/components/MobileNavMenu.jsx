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
        className="md:hidden tix-btn-secondary px-3 py-2 gap-2 shadow-sm"
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
        <span>Menú</span>
      </button>
    );
  }

  // Menú abierto - drawer/modal
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Menu drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[290px] max-w-[88vw] bg-white z-50 md:hidden shadow-2xl overflow-y-auto rounded-l-3xl border-l border-slate-100">
        {/* Header del drawer */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              T
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">TixSwap</div>
              <div className="text-xs text-slate-500">Menú rápido</div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-full transition"
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
        <nav className="p-4 space-y-1.5">
          <button
            onClick={handleBuyClick}
            className="w-full text-left px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-semibold transition hover:bg-blue-100"
          >
            Comprar
          </button>
          <button
            onClick={handleSellClick}
            className="w-full text-left px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium transition hover:bg-slate-50"
          >
            Vender
          </button>
          <button
            onClick={handleHowItWorksClick}
            className="w-full text-left px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium transition hover:bg-slate-50"
          >
            Cómo funciona
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
                className="block w-full text-left px-4 py-2.5 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-medium transition"
              >
                Mi cuenta
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-red-50 text-slate-700 hover:text-red-600 font-medium transition"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                onClick={() => setIsOpen(false)}
                className="block w-full text-left px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium transition hover:bg-blue-700"
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
