"use client";

import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="w-full px-6 py-4 flex items-center justify-between bg-white shadow-sm">
      {/* LOGO SOLO TEXTO */}
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-[#2563eb]">TixSwap</span>
        <span className="text-sm text-gray-500 -mt-1">
          Reventa segura, en un clic
        </span>
      </div>

      {/* MENU */}
      <nav className="hidden md:flex items-center space-x-10 text-gray-700 font-medium">
        <Link href="#">Comprar</Link>
        <Link href="#">Vender</Link>
        <Link href="#">Cómo funciona</Link>
      </nav>

      {/* BOTONES */}
      <div className="flex items-center space-x-3">
        <button className="text-gray-700 hover:text-black">Iniciar sesión</button>
        <button className="bg-[#2563eb] text-white px-4 py-2 rounded-lg hover:bg-[#1e4ecb]">
          Registrarse
        </button>
      </div>
    </header>
  );
}

