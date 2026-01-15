"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7ff] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Valida tu correo</h1>
        <p className="text-gray-600 mb-6">
          Te enviamos un link de confirmación a:
        </p>

        <div className="bg-[#eaf2ff] rounded-xl px-4 py-3 mb-6 text-sm font-medium break-all">
          {email || "tu correo"}
        </div>

        <div className="text-sm text-gray-600 space-y-2 mb-6">
          <p>✅ Abre tu correo y haz click en el link de confirmación.</p>
          <p>📩 Si no aparece, revisa <b>Spam / Promociones</b>.</p>
          <p>🔁 Después de confirmar, vuelve y <b>inicia sesión</b>.</p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="/login"
            className="w-full rounded-xl py-3 font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition"
          >
            Ir a iniciar sesión
          </a>

          <a
            href="/register"
            className="w-full rounded-xl py-3 font-semibold text-[#2563eb] bg-white border border-[#2563eb] hover:bg-[#f4f7ff] transition"
          >
            Volver al registro
          </a>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
