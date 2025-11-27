export default function Hero() {
  return (
    <section className="w-full py-28 px-6 flex flex-col items-center text-center">
      <h1 className="text-5xl font-bold mb-6">
        Compra y vende entradas de forma segura.
      </h1>

      <p className="text-lg text-gray-300 max-w-2xl">
        TixSwap es la plataforma chilena para publicar, vender y comprar entradas 
        sin riesgo de estafas. Funciona con pago seguro y entrega garantizada.
      </p>

      <div className="mt-10 flex gap-4">
        <a
          href="#"
          className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl font-semibold"
        >
          Publicar entrada
        </a>

        <a
          href="#"
          className="border border-gray-600 hover:border-purple-500 px-6 py-3 rounded-xl font-semibold"
        >
          Ver eventos
        </a>
      </div>

      <img
        src="/mockups/app-preview.png"
        className="mt-16 w-full max-w-3xl rounded-2xl shadow-lg"
      />
    </section>
  );
}
