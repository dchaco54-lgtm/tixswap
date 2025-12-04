"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

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

    if (!fullName.trim() || !rut.trim() || !email.trim() || !password) {
      setErrorMessage("Completa todos los campos obligatorios.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      // 1) Revisar si el RUT ya existe usando la función rut_exists
      const {
        data: rutExists,
        error: rutCheckError,
      } = await supabase.rpc("rut_exists", {
        rut_input: rut.trim(),
      });

      if (rutCheckError) {
        console.error("Error revisando RUT:", rutCheckError);
        setErrorMessage(
          "Ocurrió un problema al validar el RUT. Intenta nuevamente en unos minutos."
        );
        setLoading(false);
        return;
      }

      if (rutExists) {
        setErrorMessage(
          "Este RUT ya tiene una cuenta en TixSwap. Si olvidaste tu contraseña, recupérala en “¿Olvidaste tu contraseña?” al iniciar sesión."
        );
        setLoading(false);
        return;
      }

      // 2) Si el RUT no existe, seguimos con el registro normal
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName.trim(),
            full_name: fullName.trim(),
            rut: rut.trim(),
            phone: phone.trim(),
            userType,
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("email") && msg.includes("already")) {
          setErrorMessage(
            "Este correo ya está registrado en TixSwap. Intenta iniciar sesión o recuperar tu contraseña."
          );
        } else {
          setErrorMessage(
            "Ocurrió un problema al crear tu cuenta. Intenta nuevamente en unos minutos."
          );
        }

        setLoading(false);
        return;
      }

      setSuccessMessage(
        "Cuenta creada correctamente. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Ocurrió un problema al crear tu cuenta. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Juan Pérez González"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="Usuario general">Usuario general</option>
              <option value="Promotor">Promotor</option>
              <option value="Ticket broker">Ticket broker</option>
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
      </div>
    </main>
  );
}
