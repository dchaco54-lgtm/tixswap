'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* NAVBAR */}
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

            {/* ESTE ES EL BOTÓN IMPORTANTE */}
            <Link
              href="/sell"
              className="text-gray-700 hover:text-blue-600 font-medium"
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

          {/* Botones sesión */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* Hero */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
            Intercambia entradas
            <br />
            <span className="text-blue-600">de forma segura</span>
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            El marketplace más confiable de Chile para comprar y vender entradas.
            Sistema de garantía, validación de tickets y pago protegido.
          </p>

          {/* Buscador falso por ahora */}
          <div className="mx-auto max-w-xl">
            <input
              type="text"
              placeholder="Busca eventos, artistas, lugares..."
              className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
            ¿Cómo funciona TixSwap?
          </h2>

          <div className="grid gap-6 md:grid-cols-3 text-sm">
            <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                1. Publica tu entrada
              </h3>
              <p className="text-gray-600">
                Sube tu ticket, describe el sector, fila, asiento y fija el precio de venta.
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                2. Validamos y aseguramos el pago
              </h3>
              <p className="text-gray-600">
                Verificamos que el ticket sea válido y mantenemos el pago protegido
                hasta completar el intercambio.
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                3. Recibes tu dinero
              </h3>
              <p className="text-gray-600">
                Una vez confirmado el uso del ticket, liberamos el pago a tu cuenta.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
