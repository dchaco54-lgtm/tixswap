'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Leemos las vars de entorno públicas de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Creamos el cliente SOLO si las vars existen
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function Navbar() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const handleSellClick = async (e) => {
    e.preventDefault();

    // Si no tenemos supabase configurado, no bloqueamos: vamos directo a /sell
    if (!supabase) {
      router.push('/sell');
      return;
    }

    try {
      setChecking(true);

      const { data } = await supabase.auth.getSession();

      if (data && data.session) {
        // ✅ Usuario con sesión -> directo a vender
        router.push('/sell');
      } else {
        // ❌ Sin sesión -> ir a login con redirect
        router.push('/login?redirectTo=/sell');
      }
    } catch (err) {
      console.error('Error revisando sesión:', err);
      // Ante cualquier error, preferimos mandarlo a login
      router.push('/login?redirectTo=/sell');
    } finally {
      setChecking(false);
    }
  };

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

          {/* VENDER con lógica de sesión */}
          <button
            type="button"
            onClick={handleSellClick}
            className="text-gray-700 hover:text-blue-600 underline-offset-4"
            disabled={checking}
          >
            {checking ? 'Validando…' : 'Vender'}
          </button>

          <Link
            href="#como-funciona"
            className="text-gray-700 hover:text-blue-600"
          >
            Cómo funciona
          </Link>
        </nav>

        {/* Botones de sesión (solo UI por ahora) */}
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
  );
}

