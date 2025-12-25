"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import supabase from "../lib/supabaseClient";
import { formatRut, isValidRut, normalizeRut } from "../lib/rutUtils";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    rut: "",
    email: "",
    phone: "",
    userType: "Comprador frecuente",
    password: "",
    confirmPassword: "",
  });

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Formateo suave del RUT mientras escriben
    if (name === "rut") {
      setFormData((prev) => ({ ...prev, rut: value }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    setErrorMessage("");
    setSuccessMessage("");

    const { fullName, rut, email, phone, userType, password, confirmPassword } =
      formData;

    if (!fullName?.trim()) return "Ingresa tu nombre completo.";
    if (!rut?.trim()) return "Ingresa tu RUT.";
    if (!isValidRut(rut)) return "El RUT ingresado no es válido.";
    if (!email?.trim()) return "Ingresa tu correo electrónico.";
    if (!phone?.trim()) return "Ingresa tu teléfono.";
    if (!userType?.trim()) return "Selecciona un tipo de usuario.";
    if (!password) return "Ingresa una contraseña.";
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (password !== confirmPassword) return "Las contraseñas no coinciden.";
    if (!acceptTerms)
      return "Debes aceptar los Términos y Condiciones para crear tu cuenta.";

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const rutNormalized = normalizeRut(formData.rut);

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            rut: rutNormalized,
            phone: formData.phone,
            user_type: formData.userType,
          },
        },
      });

      if (error) throw error;

      setSuccessMessage(
        "Cuenta creada. Revisa tu correo para confirmar tu registro."
      );

      // Si Supabase devuelve sesión (según config), puedes redirigir directo
      // Si NO devuelve sesión (por confirmación email), mejor enviar a /login con mensaje
      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch (err) {
      setErrorMessage(err?.message || "No pudimos crear tu cuenta. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-gray-600">
            Regístrate para comprar y vender entradas de forma segura.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <input
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Ej: Juan Pérez"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">RUT</label>
              <input
                name="rut"
                type="text"
                value={formData.rut}
                onChange={handleChange}
                onBlur={() =>
                  setFormData((prev) => ({ ...prev, rut: formatRut(prev.rut) }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="12.345.678-9"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Validaremos que el RUT sea correcto (incluyendo dígito verificador).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="tucorreo@correo.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="+56912345678"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tipo de usuario
              </label>
              <select
                name="userType"
                value={formData.userType}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option>Comprador frecuente</option>
                <option>Vendedor frecuente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Repetir contraseña
              </label>
              <input
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                autoComplete="new-password"
              />
            </div>

            {/* ✅ Términos */}
            <div className="pt-1">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <span>
                  He leído y acepto los{" "}
                  <Link
                    href="/legal/terms"
                    className="font-medium text-blue-600 hover:underline"
                    target="_blank"
                  >
                    Términos y Condiciones
                  </Link>{" "}
                  de TixSwap.
                  <div className="mt-1 text-xs text-gray-500">
                    Si no aceptas los Términos, no podrás crear tu cuenta.
                  </div>
                </span>
              </label>
            </div>

            {/* ✅ Botón: ahora ES submit, no revienta */}
            <button
              type="submit"
              disabled={isSubmitting || !acceptTerms}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                isSubmitting || !acceptTerms
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting ? "Creando..." : "Crear cuenta"}
            </button>

            <p className="text-center text-sm text-gray-600">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
