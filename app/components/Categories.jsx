import Link from "next/link";

export default function Categories() {
  return (
    <section className="bg-[#F2ECFF]/45 py-20 px-6 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[#7B3FF2]">
        Claro desde el comienzo
      </p>
      <h2 className="font-display mt-3 text-3xl font-bold text-[#1A1333] mb-14 fade-slide-up">
        ¿Cómo funciona TixSwap?
      </h2>

      <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">

        {/* 1. Pago Protegido */}
        <div className="p-10 bg-white rounded-3xl border border-[#E4D9FF] shadow-md hover-pop fade-slide-up delay-[0ms] opacity-0">
          <div className="w-20 h-20 rounded-full bg-[#F2ECFF] border border-[#D8C8FF] shadow-sm flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#7B3FF2" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l7 4v3c0 5-3.5 8-7 9-3.5-1-7-4-7-9V10l7-4z" />
            </svg>
          </div>

          <h3 className="font-display text-xl font-bold mt-6 text-[#1A1333]">Pago con seguimiento</h3>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Revisa cada etapa de tu compra y accede a soporte si algo no sale como esperabas.
          </p>
        </div>

        {/* 2. Usuarios Verificados */}
        <div className="p-10 bg-white rounded-3xl border border-[#E4D9FF] shadow-md hover-pop fade-slide-up delay-[150ms] opacity-0">
          <div className="w-20 h-20 rounded-full bg-[#F2ECFF] border border-[#D8C8FF] shadow-sm flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#7B3FF2" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 14c1.656 0 3 1.567 3 3.5 0 1.933-1.344 3.5-3 3.5s-3-1.567-3-3.5c0-1.933 1.344-3.5 3-3.5zM8 14c1.656 0 3 1.567 3 3.5C11 19.433 9.656 21 8 21s-3-1.567-3-3.5c0-1.933 1.344-3.5 3-3.5zM16 3a3 3 0 110 6 3 3 0 010-6zM8 3a3 3 0 110 6 3 3 0 010-6z" />
            </svg>
          </div>

          <h3 className="font-display text-xl font-bold mt-6 text-[#1A1333]">Señales de confianza</h3>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Revisa la información disponible del vendedor y las señales de verificación antes de comprar.
          </p>
        </div>

        {/* 3. Chat Integrado */}
        <div className="p-10 bg-white rounded-3xl border border-[#E4D9FF] shadow-md hover-pop fade-slide-up delay-[300ms] opacity-0">
          <div className="w-20 h-20 rounded-full bg-[#F2ECFF] border border-[#D8C8FF] shadow-sm flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#7B3FF2" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4H7l-4 3V8z" />
            </svg>
          </div>

          <h3 className="font-display text-xl font-bold mt-6 text-[#1A1333]">Coordinación en un solo lugar</h3>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Para entradas nominadas, chatea con el vendedor para coordinar el cambio de nombre y una entrega segura.
          </p>
        </div>

      </div>

      {/* Saber más (NO rompe el layout, va justo donde marcaste en rojo) */}
      <div className="max-w-6xl mx-auto mt-10 flex justify-end">
        <Link href="/how-it-works" className="brand-focus rounded font-semibold text-[#4A1E9E] hover:underline">
          Saber más →
        </Link>
      </div>
    </section>
  );
}


