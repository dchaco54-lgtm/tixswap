// app/components/Hero.jsx
"use client";

export default function Hero({ searchTerm, onSearchChange }) {
  return (
    <section className="gradient-hero pt-32 pb-24 px-6 text-center">
      <h1 className="text-5xl font-extrabold leading-tight">
        Intercambia entradas <br />
        <span className="text-blue-600">de forma segura</span>
      </h1>

      <p className="mt-4 text-gray-600 text-lg max-w-2xl mx-auto">
        El marketplace más confiable de Chile para comprar y vender entradas.
        Sistema de garantía, validación de tickets y pago protegido.
      </p>

      <div className="mt-8 mx-auto max-w-xl">
        <input
          value={searchTerm}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Busca eventos, artistas, lugares..."
          className="w-full px-4 py-3 rounded-xl shadow-soft border border-gray-200"
        />
      </div>
    </section>
  );
}
