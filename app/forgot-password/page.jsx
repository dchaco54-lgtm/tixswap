// app/forgot-password/page.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage("Ingresa un correo válido.");
      return;
    }

    try {
      setSending(true);

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error(error);
        setErrorMessage(
          "No pudimos enviar el correo de recuperación. Inténtalo de nuevo en unos minutos."
        );
        return;
      }

      setSuccessMessage(
        "Te enviamos un correo con el enlace para crear una nueva contraseña. Revisa tu bandeja de entrada o spam."
      );
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Ocurrió un problema al solicitar la recuperación. Inténtalo nuevamente."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Ingresa el correo con el que creaste tu cuenta en TixSwap y te
          enviaremos un enlace para crear una nueva contraseña.
        </p>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Enviando correo..." : "Enviar enlace de recuperación"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Ya recordaste tu clave?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
