'use client';

import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        {/* Logo + tagline */}
        <div className="flex items-baseline gap-2">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            TixSwap
          </Link>
          <span className="text-xs text-gray-500">
            Reventa segura, en un clic
          </span>
        </div>

        {/* Menú central */}
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className="text-gray-700 hover:text-blue-600"
          >
            Comprar
          </Link>

          {/* VENDER -> va a /sell */}
          <Link
            href="/sell"
            className="text-gray-700 hover:text-blue-600 underline-offset-4"
          >
            Vender
          </Link>

          <Link
            href="#como-funciona"
            className="text-gray-700 hover:text-blue-600"
          >
            Cómo funciona
          </Link>
        </nav>

        {/* Botones de sesión (UI por ahora) */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
