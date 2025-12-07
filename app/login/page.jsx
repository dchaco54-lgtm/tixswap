"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Si venías desde /sell, acá viene ?redirectTo=/sell
  // Si no, por defecto te mando al dashboard
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    const { email, password } = form;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("email not confirmed")) {
          setErrorMessage(
            "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada o spam."
          );
        } else if (msg.includes("invalid login credentials")) {
          setErrorMessage("Correo o contraseña incorrectos.");
        } else {
          setErrorMessage(
            "Ocurrió un problema al iniciar sesión. Inténtalo de nuevo en unos minutos."
          );
        }
        return;
      }

      // ✅ Login correcto → respetamos redirectTo (sell, dashboard, etc.)
      router.push(redirectTo);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Ocurrió un problema al iniciar sesión. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barra arriba para volver al inicio */}
      <div className="w-full max-w-5xl mx-auto px-4 pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
        >
          <span className="mr-1">←</span>
          Volver al inicio
        </Link>
        <Link href="/" className="text-lg font-bold text-blue-600">
          TixSwap
        </Link>
      </div>

      {/* Contenido centrado */}
      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Iniciar sesión
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Accede a tu cuenta de TixSwap.
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {errorMessage}
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
                value={form.email}
                onChange={handleChange("email")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="********"
                value={form.password}
                onChange={handleChange("password")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-gray-500">
            <p>
              ¿Olvidaste tu contraseña?{" "}
              <Link
                href="/forgot-password"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Recuperar acceso
              </Link>
            </p>
            <p>
              ¿Todavía no tienes cuenta?{" "}
              <Link
                href="/register"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Crear cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
