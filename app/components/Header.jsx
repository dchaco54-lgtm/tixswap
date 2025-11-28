export default function Header() {
  return (
    <header className="w-full py-4 px-6 flex items-center justify-between bg-white shadow-sm fixed top-0 left-0 z-50">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-blue-600 rounded-lg" />
        <div className="font-bold text-xl">TixSwap</div>
      </div>

      <nav className="hidden md:flex gap-8 text-gray-700">
        <a href="#">Comprar</a>
        <a href="#">Vender</a>
        <a href="#">Cómo funciona</a>
      </nav>

      <div className="flex gap-4">
        <button className="text-sm">Iniciar sesión</button>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm shadow-soft">
          Registrarse
        </button>
      </div>
    </header>
  );
}
