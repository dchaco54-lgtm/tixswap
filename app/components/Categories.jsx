import Link from "next/link";

export default function Categories() {
  return (
    <section className="py-20 px-6 text-center">
      <h2 className="text-3xl font-bold mb-14 fade-slide-up">¿Cómo funciona TixSwap?</h2>

      <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">

        {/* 1. Pago Protegido */}
        <div className="p-10 bg-white rounded-2xl shadow-md hover-pop fade-slide-up delay-[0ms] opacity-0">
          <div className="w-20 h-20 rounded-full bg-blue-100 border border-blue-300/50 shadow-sm flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="rgb(37,99,235)" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l7 4v3c0 5-3.5 8-7 9-3.5-1-7-4-7-9V10l7-4z" />
            </svg>
          </div>

          <h3 className="text-xl font-bold mt-6">Pago Protegido</h3>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Compra con confianza. Retenemos tu dinero hasta que tu compra esté confirmada según nuestras reglas de seguridad.
            Si hay problemas, te devolvemos el 100%.
          </p>
        </div>

        {/* 2. Usuarios Verificados */}
        <div className="p-10 bg-white rounded-2xl shadow-md hover-pop fade-slide-up delay-[150ms] opacity-0">
          <div className="w-20 h-20 rounded-full bg-blue-100 border border-blue-300/50 shadow-sm flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="rgb(37,99,235)" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 14c1.656 0 3 1.567 3 3.5 0 1.933-1.344 3.5-3 3.5s-3-1.567-3-3.5c0-1.933 1.344-3.5 3-3.5zM8 14c1.656 0 3 1.567 3 3.5C11 19.433 9.656 21 8 21s-3-1.567-3-3.5c0-1.933 1.344-3.5 3-3.5zM16 3a3 3 0 110 6 3 3 0 010-6zM8 3a3 3 0 110 6 3 3 0 010-6z" />
            </svg>
          </div>

          <h3 className="text-xl font-bold mt-6">Usuarios Verificados</h3>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Todos los usuarios pasan por validación de identidad para reducir cuentas falsas y estafas.
          </p>
        </div>

        {/* 3. Chat Integrado */}
        <div className="p-10 bg-white rounded-2xl shadow-md hover-pop fade-slide-up delay-[300ms] opacity-0">
          <div className="w-20 h-20 rounded-full bg-blue-100 border border-blue-300/50 shadow-sm flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="rgb(37,99,235)" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4H7l-4 3V8z" />
            </svg>
          </div>

          <h3 className="text-xl font-bold mt-6">Chat Integrado</h3>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Para entradas nominadas, chatea con el vendedor para coordinar el cambio de nombre y una entrega segura.
          </p>
        </div>

      </div>

      {/* Saber más (NO rompe el layout, va justo donde marcaste en rojo) */}
      <div className="max-w-6xl mx-auto mt-10 flex justify-end">
        <Link href="/how-it-works" className="tix-link">
          Saber más →
        </Link>
      </div>
    </section>
  );
}



