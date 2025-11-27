export default function Features() {
  return (
    <section className="py-20 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-12">
      {[
        {
          title: "Pago Seguro",
          desc: "Tu plata queda retenida hasta que recibes la entrada real.",
        },
        {
          title: "Sin estafas",
          desc: "Validación automática y sistema de reputación.",
        },
        {
          title: "Comisiones bajas",
          desc: "Solo 2% al vendedor y 1% al comprador.",
        },
      ].map((f, i) => (
        <div key={i} className="text-center">
          <h3 className="text-2xl font-semibold mb-3">{f.title}</h3>
          <p className="text-gray-400">{f.desc}</p>
        </div>
      ))}
    </section>
  );
}
