export default function Categories() {
  const steps = [
    {
      title: "Pago Protegido",
      desc: "Retenemos tu dinero hasta que confirmes la validez de la entrada.",
      icon: "🛡️",
    },
    {
      title: "Usuarios Verificados",
      desc: "Todos los usuarios pasan validación de identidad.",
      icon: "🔐",
    },
    {
      title: "Chat Integrado",
      desc: "Coordina con el vendedor sin compartir datos personales.",
      icon: "💬",
    },
  ];

  return (
    <section className="py-20 px-6 text-center">
      <h2 className="text-3xl font-bold mb-10">¿Cómo funciona TixSwap?</h2>

      <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
        {steps.map((s, i) => (
          <div
            key={i}
            className="p-8 bg-white rounded-xl shadow-soft hover-pop"
          >
            <div className="text-5xl">{s.icon}</div>
            <h3 className="text-xl font-bold mt-4">{s.title}</h3>
            <p className="text-gray-600 mt-2">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
