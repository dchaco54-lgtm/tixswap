import { ShieldCheck, Users, MessageCircle } from "lucide-react";

export default function Categories() {
  return (
    <section className="py-20 bg-white">
      <h2 className="text-center text-3xl font-bold mb-16">
        ¿Cómo funciona TixSwap?
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-6xl mx-auto px-6">

        {/* 1. Pago Protegido */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-blue-100">
            <ShieldCheck className="w-10 h-10 text-[#2563eb]" />
          </div>
          <h3 className="text-xl font-bold mb-3">1. Pago Protegido</h3>
          <p className="text-gray-600 leading-relaxed">
            Compra con confianza. Retenemos tu dinero hasta que confirmes que
            recibiste tu entrada válida. Si hay problemas, te devolvemos el
            100%.
          </p>
        </div>

        {/* 2. Usuarios Verificados */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-blue-100">
            <Users className="w-10 h-10 text-[#2563eb]" />
          </div>
          <h3 className="text-xl font-bold mb-3">2. Usuarios Verificados</h3>
          <p className="text-gray-600 leading-relaxed">
            Sistema de calificaciones y reputación. Todos los usuarios están
            verificados con RUT y teléfono validado por SMS.
          </p>
        </div>

        {/* 3. Chat Integrado */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-blue-100">
            <MessageCircle className="w-10 h-10 text-[#2563eb]" />
          </div>
          <h3 className="text-xl font-bold mb-3">3. Chat Integrado</h3>
          <p className="text-gray-600 leading-relaxed">
            Para entradas nominadas, chatea directamente con el vendedor para
            coordinar el cambio de nombre y entrega segura.
          </p>
        </div>

      </div>
    </section>
  );
}

