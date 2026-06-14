"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") || "email";
  // 'signup' is a legacy alias; supabase-js v2 verifyOtp expects 'email' for email confirmation
  const type = rawType === "signup" ? "email" : rawType;
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const hasToken = Boolean(code || tokenHash);

  async function handleConfirm() {
    if (!hasToken) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const supabase = createClient();
      let error;

      if (tokenHash) {
        ({ error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        }));
      } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      }

      if (error) {
        throw new Error(`[${code ? "code" : "token_hash"}/${type}] ${error.message}`);
      }

      setStatus("success");
      router.push(`${redirectTo}?confirmed=true`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.message || "No se pudo confirmar el correo. Intenta registrarte de nuevo.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7ff] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
        <div className="text-5xl mb-4">✉️</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Confirma tu cuenta
        </h1>
        <p className="mt-2 mb-6 text-sm text-slate-500">
          Haz clic en el botón para activar tu cuenta en TixSwap.
        </p>

        {!hasToken && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Link de confirmación inválido. Intenta registrarte de nuevo.
          </div>
        )}

        {status === "error" && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        )}

        {status === "success" ? (
          <p className="text-green-600 font-semibold">
            ¡Cuenta confirmada! Redirigiendo...
          </p>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={status === "loading" || !hasToken}
            className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Confirmando..." : "Confirmar mi cuenta"}
          </button>
        )}

        <p className="mt-6 text-xs text-slate-400">
          ¿Problemas?{" "}
          <a href="/register" className="text-blue-600 hover:underline">
            Volver al registro
          </a>
        </p>
      </div>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Cargando...
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
