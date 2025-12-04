"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

// Helpers para RUT
function cleanRut(rut) {
  return rut.replace(/[^0-9kK]/g, "");
}

function isValidRut(rut) {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const mod = 11 - (sum % 11);
  let dvCalc;
  if (mod === 11) dvCalc = "0";
  else if (mod === 10) dvCalc = "K";
  else dvCalc = String(mod);

  return dvCalc === dv;
}

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
  const [showResetLink, setShowResetLink] = useState(false);

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
    setShowResetLink(false);

    const { fullName, rut, email, phone, userType, password, passwordConfirm } =
      form;

    if (!fullName.trim()) {
      setErrorMessage("Debes ingresar tu nombre completo.");
      return;
    }

    if (!rut.trim() || !isValidRut(rut)) {
      setErrorMessage("El RUT ingresado no es válido.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Debes ingresar un correo electrónico.");
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

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            rut: rut.trim(),
            phone: phone.trim(),
            userType,
          },
        },
      });

      if (error) {
        console.error(error);
        const msg = (error.message || "").toLowerCase();

        // Usuario ya existe (por correo)
        if (
          msg.includes("already registered") ||
          msg.includes("user already registered") ||
          msg.includes("duplicate")
        ) {
          setErrorMessage(
            "Este RUT o correo ya tiene una cuenta en TixSwap."
          );
          setShowResetLink(true);
          return;
        }

        setErrorMessage(
          "Ocurrió un problema al crear tu cuenta. Inténtalo nuevamente."
        );
        return;
      }

      setSuccessMessage(
        "Cuenta creada correctamente. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión."
      );

      // Redirigimos al login después de unos segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Crear cuenta
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Regístrate para comprar y vender entradas en TixSwap.
        </p>

        {errorMessage && (
          <div className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {showResetLink && (
          <p className="mb-4 text-xs text-gray-500 text-center">
            Si olvidaste tu contraseña,{" "}
            <Link
              href="/forgot-password"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              recupérala aquí
            </Link>
            .
          </p>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Juan Pérez"
              value={form.fullName}
              onChange={handleChange("fullName")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT
            </label>
            <input
              type="text"
              required
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de usuario
            </label>
            <select
              value={form.userType}
              onChange={handleChange("userType")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Usuario general">Usuario general</option>
              <option value="Comprador frecuente">Comprador frecuente</option>
              <option value="Vendedor frecuente">Vendedor frecuente</option>
              <option value="Promotor de eventos">Promotor de eventos</option>
            </select>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repetir contraseña
            </label>
            <input
              type="password"
              required
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
  );
}
