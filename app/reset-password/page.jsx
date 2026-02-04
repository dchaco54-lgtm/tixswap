// app/reset-password/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { validatePasswordStrength } from "@/lib/validations";
import PasswordField from "@/components/PasswordField";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [passwordChecks, setPasswordChecks] = useState(() => validatePasswordStrength("").checks);

  const PASSWORD_CHECK_ITEMS = [
    { key: "minLen", label: "Mínimo 10 caracteres" },
    { key: "hasUpper", label: "Mayúscula" },
    { key: "hasLower", label: "Minúscula" },
    { key: "hasNumber", label: "Número" },
    { key: "hasSpecial", label: "Caracter especial" },
    { key: "noSpaces", label: "Sin espacios" },
    { key: "notCommon", label: "No común" },
    { key: "notBrand", label: "Sin 'tixswap'" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!password || !password2) {
      setErrorMessage("Debes ingresar y confirmar tu nueva contraseña.");
      return;
    }

    if (password !== password2) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    const passwordStrength = validatePasswordStrength(password);
    setPasswordChecks(passwordStrength.checks);

    if (!passwordStrength.valid) {
      setErrorMessage(passwordStrength.message);
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error(error);
        setErrorMessage(
          "No pudimos actualizar tu contraseña. Es posible que el enlace haya expirado. Solicita un nuevo correo de recuperación."
        );
        return;
      }

      setSuccessMessage(
        "Tu contraseña fue actualizada correctamente. Ahora puedes iniciar sesión con tu nueva clave."
      );

      // Opcional: redirigir después de unos segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Ocurrió un problema al actualizar tu contraseña. Inténtalo nuevamente."
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Crear nueva contraseña
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Elige una nueva contraseña para tu cuenta de TixSwap.
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
              Nueva contraseña
            </label>
            <PasswordField
              value={password}
              onChange={(e) => {
                const value = e.target.value;
                setPassword(value);
                setPasswordChecks(validatePasswordStrength(value).checks);
              }}
              placeholder="Ej: NuevaClave9!"
              inputClassName="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              autoComplete="new-password"
              name="password"
              id="password"
            />
            <ul className="mt-2 space-y-1 text-xs">
              {PASSWORD_CHECK_ITEMS.map((item) => {
                const passed = Boolean(passwordChecks[item.key]);
                return (
                  <li
                    key={item.key}
                    className={passed ? "text-green-700" : "text-gray-500"}
                  >
                    {passed ? "✅" : "❌"} {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar nueva contraseña
            </label>
            <PasswordField
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="********"
              inputClassName="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              autoComplete="new-password"
              name="password2"
              id="password2"
            />
          </div>

          <button
            type="submit"
            disabled={updating}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {updating ? "Actualizando..." : "Guardar nueva contraseña"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Te equivocaste de correo o enlace?{" "}
          <Link
            href="/forgot-password"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Solicitar otro link
          </Link>
        </p>
      </div>
    </div>
  );
}
