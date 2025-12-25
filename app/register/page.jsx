"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { isValidRut, normalizeRut } from "../lib/rutUtils";

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    rut: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRutChange = (e) => {
    setFormData((prev) => ({ ...prev, rut: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const name = formData.name.trim();
    const rutNormalized = normalizeRut(formData.rut);
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    if (!name) return setError("Debes ingresar tu nombre completo.");
    if (!isValidRut(rutNormalized))
      return setError(
        "El RUT ingresado no es válido. Revisa el formato y dígito verificador."
      );
    if (!email) return setError("Debes ingresar un correo electrónico.");
    if (!phone) return setError("Debes ingresar un teléfono.");
    if (!password || password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirmPassword)
      return setError("Las contraseñas no coinciden.");
    if (!acceptedTerms)
      return setError(
        "Debes aceptar los Términos y Condiciones para crear tu cuenta."
      );

    setLoading(true);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { data, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}/login`,
            data: {
              // 👇 COMPAT: algunos triggers buscan "name", otros "full_name"
              name,                // ✅ para triggers antiguos
              full_name: name,     // ✅ para triggers nuevos

              rut: rutNormalized,
              phone,

              accepted_terms: true,
              accepted_terms_at: new Date().toISOString(),
              accepted_terms_version: "1.0",
            },
          },
        }),
        15000
      );

      if (signUpError) {
        console.error("Supabase signUpError:", signUpError);
        setError(signUpError.message || "No se pudo crear la cuenta.");
        return;
      }

      console.log("Supabase signUp ok:", data);

      setSuccess(
        "Cuenta creada ✅ Revisa tu correo para confirmar tu email antes de iniciar sesión."
      );

      setFormData((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    } catch (err) {
      console.error("Register unexpected error:", err);

      if (err?.message === "timeout") {
        setError(
          "La solicitud se demoró demasiado (timeout). Revisa tu conexión o configuración de Supabase y reintenta."
        );
      } else {
        setError("Ocurrió un error inesperado. Inténtalo nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
        <p className="text-gray-500 mt-1">
          Regístrate para comprar y vender entradas de forma segura.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre completo
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">RUT</label>
            <input
              type="text"
              name="rut"
              value={formData.rut}
              onChange={handleRutChange}
              placeholder="Ej: 12345678-9"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Validaremos que el RUT sea correcto (incluyendo dígito verificador).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ej: correo@dominio.com"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+569XXXXXXXX"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Repetir contraseña
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                He leído y acepto los{" "}
                <Link
                  href="/legal/terms"
                  className="text-blue-600 hover:underline font-medium"
                  target="_blank"
                >
                  Términos y Condiciones
                </Link>{" "}
                de TixSwap.
                <div className="text-xs text-gray-500 mt-1">
                  Si no aceptas los Términos, no podrás crear tu cuenta.
                </div>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className={`w-full mt-2 px-4 py-3 rounded-lg text-white font-semibold transition ${
              loading || !acceptedTerms
                ? "bg-[#1f52f0] opacity-50 cursor-not-allowed"
                : "bg-[#1f52f0] hover:bg-blue-700"
            }`}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md">
              {success}
              <div className="mt-2">
                <Link href="/login" className="text-blue-600 hover:underline">
                  Ir a iniciar sesión
                </Link>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 text-center mt-2">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
