import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo / nombre */}
        <Link href="/" className="text-lg font-semibold text-gray-900">
          TixSwap
        </Link>

        {/* Navegación derecha */}
        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Inicio
          </Link>

          {/* Botón VENDER */}
          <Link
            href="/sell"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Vender
          </Link>
        </nav>
      </div>
    </header>
  );
}

