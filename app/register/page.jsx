// app/register/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

// ----------------- Helpers RUT -----------------

function normalizeRut(raw) {
  if (!raw) return "";
  const clean = raw.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body}-${dv}`;
}

function isValidRut(raw) {
  if (!raw) return false;

  const clean = raw.replace(/\./g, "").replace(/-/g, "").toUpperCase();

  // Largo razonable
  if (clean.length < 7 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Cuerpo sólo números
  if (!/^\d+$/.test(body)) return false;

  // ❗Bloque extra anti-RUT trucho:
  const allSameDigit = new Set(body.split("")).size === 1;
  const blacklistedBodies = ["12345678", "87654321"];

  if (allSameDigit || blacklistedBodies.includes(body)) {
    return false;
  }

  // Cálculo dígito verificador (módulo 11)
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const calc = 11 - remainder;

  let dvCalc;
  if (calc === 11) dvCalc = "0";
  else if (calc === 10) dvCalc = "K";
  else dvCalc = String(calc);

  return dvCalc === dv;
}

// ----------------- Página -----------------

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: "",
    rut: "",
    email: "",
    phone: "",
    userType: "Usuario general",
    password: "",
    passwordConfirm: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const {
      fullName,
      rut,
      email,
      phone,
      userType,
      password,
      passwordConfirm,
    } = form;

    // Validaciones básicas
    if (
      !fullName.trim() ||
      !rut.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !passwordConfirm
    ) {
      setErrorMessage("Por favor completa todos los campos.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    if (!isValidRut(rut)) {
      setErrorMessage("El RUT ingresado no es válido.");
      return;
    }

    const normalizedRut = normalizeRut(rut);

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            rut: normalizedRut,
            phone: phone.trim(),
            userType,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("already registered")) {
          setErrorMessage(
            "Este correo ya tiene una cuenta en TixSwap. Intenta iniciar sesión o recupera tu contraseña."
          );
        } else {
          setErrorMessage(
            "Ocurrió un problema al crear tu cuenta. Inténtalo nuevamente."
          );
        }
        return;
      }

      if (data?.user) {
        setSuccessMessage(
          "Cuenta creada correctamente. Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada o spam."
        );

        setForm({
          fullName: "",
          rut: "",
          email: "",
          phone: "",
          userType: "Usuario general",
          password: "",
          passwordConfirm: "",
        });

        // Si quieres redirigir automáticamente después:
        // setTimeout(() => router.push("/login"), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Ocurrió un problema al crear tu cuenta. Inténtalo nuevamente."
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
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Crear cuenta
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Regístrate para comprar y vender entradas en TixSwap.
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
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                placeholder="Ej: Juan Pérez"
                value={form.fullName}
                onChange={handleChange("fullName")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* RUT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT
              </label>
              <input
                type="text"
                placeholder="12345678-9"
                value={form.rut}
                onChange={handleChange("rut")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Validaremos que el RUT sea correcto (incluyendo dígito
                verificador).
              </p>
            </div>

            {/* Correo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={handleChange("email")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                placeholder="+569..."
                value={form.phone}
                onChange={handleChange("phone")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Tipo de usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de usuario
              </label>
              <select
                value={form.userType}
                onChange={handleChange("userType")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="Usuario general">Usuario general</option>
                <option value="Comprador frecuente">Comprador frecuente</option>
                <option value="Vendedor frecuente">Vendedor frecuente</option>
                <option value="Promotor de eventos">Promotor de eventos</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                placeholder="********"
                value={form.password}
                onChange={handleChange("password")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Confirmar password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repetir contraseña
              </label>
              <input
                type="password"
                placeholder="********"
                value={form.passwordConfirm}
                onChange={handleChange("passwordConfirm")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
