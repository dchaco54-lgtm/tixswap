export default function Footer() {
  return (
    <footer className="bg-[#0c0f19] text-gray-300 py-12 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
        <div>
          <h3 className="font-bold text-lg mb-3">TixSwap</h3>
          <p>Reventa segura en un clic.</p>
        </div>

        <div>
          <h4 className="font-bold mb-3">Plataforma</h4>
          <p>Comprar</p>
          <p>Vender</p>
          <p>Cómo funciona</p>
        </div>

        <div>
          <h4 className="font-bold mb-3">Soporte</h4>
          <p>Centro de ayuda</p>
          <p>Contacto</p>
          <p>Disputas</p>
        </div>

        <div>
          <h4 className="font-bold mb-3">Legal</h4>
          <p>Términos</p>
          <p>Privacidad</p>
          <p>Seguridad</p>
        </div>
      </div>

      <p className="text-center mt-10 text-gray-500">
        © 2026 TixSwap. Todos los derechos reservados.
      </p>
    </footer>
  );
}
