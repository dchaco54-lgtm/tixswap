"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    rut: "",
    email: "",
    phone: "",
    userType: "Usuario general",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (field) => (e) => {
    const value =
      field === "termsAccepted" ? e.target.checked : e.target.value;

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (form.password !== form.confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    if (!form.termsAccepted) {
      setErrorMsg(
        "Debes aceptar los términos y condiciones para crear tu cuenta."
      );
      return;
    }

    setLoading(true);

    // Si Supabase no está configurado, no intentamos registrar
    if (!supabase) {
      setLoading(false);
      setErrorMsg("El servicio de registro aún no está configurado.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          rut: form.rut,
          phone: form.phone,
          user_type: form.userType,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "Ocurrió un error al crear la cuenta.");
      return;
    }

    setSuccessMsg(
      "Cuenta creada correctamente. Revisa tu correo para confirmar la cuenta."
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-soft p-8">
        <h1 className="text-3xl font-bold text-center mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Únete al marketplace más seguro de Chile
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre completo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              required
              placeholder="Tu nombre completo"
              value={form.name}
              onChange={handleChange("name")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
            />
          </div>

          {/* RUT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT
            </label>
            <input
              type="text"
              required
              placeholder="12.345.678-9"
              value={form.rut}
              onChange={handleChange("rut")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
            />
          </div>

          {/* Correo */}
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono (para validación SMS)
            </label>
            <input
              type="tel"
              required
              placeholder="+56987654321"
              value={form.phone}
              onChange={handleChange("phone")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
            />
          </div>

          {/* Tipo de usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Qué tipo de usuario eres? (solo estadístico)
            </label>
            <select
              value={form.userType}
              onChange={handleChange("userType")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
            >
              <option>Usuario general</option>
              <option>Comprador frecuente</option>
              <option>Vendedor frecuente</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Esto no limita tus funciones, solo nos ayuda con estadísticas.
            </p>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={handleChange("password")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
              placeholder="••••••••"
            />
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
              placeholder="••••••••"
            />
          </div>

          {/* Términos */}
          <div className="flex items-start space-x-2">
            <input
              id="terms"
              type="checkbox"
              checked={form.termsAccepted}
              onChange={handleChange("termsAccepted")}
              className="mt-1 h-4 w-4 border-gray-300 rounded"
            />
            <label
              htmlFor="terms"
              className="text-xs text-gray-600 leading-relaxed"
            >
              Acepto los{" "}
              <a href="#" className="underline">
                términos y condiciones
              </a>{" "}
              y la{" "}
              <a href="#" className="underline">
                política de privacidad
              </a>
              .
            </label>
          </div>

          {/* Mensajes */}
          {errorMsg && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {successMsg}
            </p>
          )}

          {/* Botón crear cuenta */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563eb] text-white font-medium py-2.5 rounded-lg hover:bg-[#1e4ecb] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-[#2563eb] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
