"use client";

export default function AdminPage() {
  console.log("✅✅✅ ADMIN PAGE SIMPLIFICADA CARGADA ✅✅✅");
  
  return (
    <div className="min-h-screen bg-yellow-100 flex items-center justify-center p-8">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">🎉 PÁGINA ADMIN FUNCIONANDO</h1>
        <p className="text-lg text-gray-700 mb-4">
          Si ves esto, significa que la navegación a /admin está funcionando correctamente.
        </p>
        <p className="text-sm text-gray-500">
          La validación de admin se agregará de nuevo después de confirmar que la ruta funciona.
        </p>
      </div>
    </div>
  );
}
