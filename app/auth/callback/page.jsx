"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Timeout de seguridad: si en 10s no resuelve, mostrar error
        const timeoutId = setTimeout(() => {
          if (processing) {
            setError("La verificación está tomando demasiado tiempo. Intenta iniciar sesión manualmente.");
            setProcessing(false);
          }
        }, 10000);

        const redirectTo = searchParams.get("redirectTo") || "/dashboard";
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        console.log("[AuthCallback] Parámetros recibidos:", { code: !!code, tokenHash: !!tokenHash, type, redirectTo });

        // Si hay code (PKCE flow), hacer el exchange explícitamente
        if (code) {
          console.log("[AuthCallback] Intercambiando code por sesión...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error("[AuthCallback] Error en exchange:", exchangeError);
            setError("No se pudo confirmar tu correo. El enlace puede estar expirado.");
            clearTimeout(timeoutId);
            setProcessing(false);
            return;
          }
          
          console.log("[AuthCallback] Exchange exitoso, verificando sesión...");
        }

        // Verificar que la sesión fue establecida
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        clearTimeout(timeoutId);

        if (sessionError) {
          console.error("[AuthCallback] Error obteniendo sesión:", sessionError);
          setError("Error al verificar la sesión. Por favor, intenta iniciar sesión manualmente.");
          setProcessing(false);
          return;
        }

        if (session && session.user) {
          // Sesión exitosa, redirigir
          console.log("[AuthCallback] ✓ Sesión confirmada para usuario:", session.user.email);
          router.replace(redirectTo);
          return;
        }

        // Si no hay código PKCE, pero está aquí en el callback, algo pasó
        if (!code && !tokenHash) {
          console.warn("[AuthCallback] Sin parámetros PKCE, podría ser una URL incompleta");
          setError("El enlace de confirmación parece incompleto. Por favor, pide un nuevo correo de confirmación.");
          setProcessing(false);
          return;
        }

        // No hay sesión después del exchange
        setError("No se pudo confirmar tu correo. Intenta iniciar sesión manualmente.");
        setProcessing(false);

      } catch (err) {
        console.error("[AuthCallback] Error procesando callback:", err);
        setError("Ocurrió un error al procesar la confirmación. Intenta iniciar sesión manualmente.");
        setProcessing(false);
      }
    };

    handleCallback();
  }, [router, searchParams, processing]);

  if (processing) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100 text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Confirmando tu correo...
            </h1>
            <p className="text-sm text-slate-600">
              Esto tomará solo unos segundos.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Problema al confirmar
          </h1>
          
          <p className="text-sm text-slate-600 mb-6">
            {error}
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Ir a iniciar sesión
            </Link>
            
            <Link
              href="/register"
              className="block w-full text-center px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors"
            >
              Crear nueva cuenta
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="max-w-md w-full mx-auto px-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100 text-center">
              <div className="mb-4">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Confirmando tu correo...
              </h1>
              <p className="text-sm text-slate-600">
                Esto tomará solo unos segundos.
              </p>
            </div>
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
