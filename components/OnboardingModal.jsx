'use client';

export default function OnboardingModal({ onComplete }) {
  const handleComplete = () => {
    onComplete?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
        <h2 className="text-2xl font-bold mb-2">¡Bienvenido a TixSwap! 🎫</h2>
        <p className="text-gray-600 mb-6">
          Completemos tu perfil para que estés listo para comprar, vender y conectarte con otros usuarios.
        </p>

        <div className="space-y-4 mb-6">
          <div className="flex gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h3 className="font-medium text-gray-900">Nombre</h3>
              <p className="text-sm text-gray-500">Tu nombre completo en tu perfil</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-2xl">🖼️</span>
            <div>
              <h3 className="font-medium text-gray-900">Avatar</h3>
              <p className="text-sm text-gray-500">Una foto de perfil profesional</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-2xl">🟢</span>
            <div>
              <h3 className="font-medium text-gray-900">Estado</h3>
              <p className="text-sm text-gray-500">Muestra si estás activo o disponible</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleComplete}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Ir a mi perfil
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Puedes completar esto ahora o más tarde en tu panel.
        </p>
      </div>
    </div>
  );
}
