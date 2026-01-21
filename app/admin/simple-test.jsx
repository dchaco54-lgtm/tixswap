"use client";

export default function AdminTestPage() {
  console.log("✅✅✅ TEST PAGE CARGADA ✅✅✅");
  
  return (
    <div className="min-h-screen bg-red-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-red-600">PÁGINA ADMIN TEST</h1>
        <p className="mt-4">Si ves esto, la ruta /admin funciona</p>
      </div>
    </div>
  );
}
