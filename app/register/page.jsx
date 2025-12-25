"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { validateRut, formatRut, cleanRut } from "../lib/rutUtils";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: "",
    rut: "",
    email: "",
    phone: "",
    userType: "Comprador frecuente",
    password: "",
    passwordConfirm: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRutBlur = () => {
    const raw = form.rut.trim();
    if (!raw) return;

    const cleaned = cleanRut(raw);
    if (!validateRut(cleaned)) return;

    setForm((prev) => ({ ...prev, rut: formatRut(cleaned) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const fullName = form.fullName.trim();
    const rut = form.rut.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const userType = form.userType;

    if (
      !fullName ||
      !rut ||
      !email ||
      !phone ||
      !form.password ||
      !form.passwordConfirm
    ) {
      setErrorMessage("Por favor completa todos los campos.");
      return;
    }

    if (!acceptTerms) {
      setErrorMessage(
        "Debes aceptar los Términos y Condiciones para crear tu cuenta."
      );
      return;
    }

    const cleanedRut = cleanRut(rut);
    if (!validateRut(cleanedRut)) {
      setErrorMessage("El RUT no es válido. Revisa el formato y el dígito verificador.");
      return;
    }

    if (form.password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (form.password !== form.passwordConfirm) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: fullName,
            rut: cleanedRut, // guardamos limpio para consistencia
            phone,
            user_type: userType,

            // ✅ consentimiento T&C (importante para respaldo)
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString(),
            terms_version: "v1",
          },
        },
      });

      if (error) throw error;

      setSuccessMessage(
        "Cuenta creada ✅ Revisa tu correo para confirmar tu cuenta (si aplica)."
      );

      // Si tu flujo actual no requiere confirmación, puedes redirigir
      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch (err) {
      setErrorMessage(err?.message || "Ocurrió un error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header simple */}
      <header className="w-full border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold text-blue-600">TixSwap</span>
            <span className="text-sm text-gray-500">Reventa segura, en un clic</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-6 py-10 flex justify-center">
        <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h1>
          <p className="text-gray-500 mb-6">
            Regístrate para comprar y vender entradas de forma segura.
          </p>

          {errorMessage ? (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-red-700 text-sm">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-green-700 text-sm">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                placeholder="Ej: David Chacón"
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* RUT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT
              </label>
              <input
                type="text"
                placeholder="Ej: 12.345.678-9"
                value={form.rut}
                onChange={(e) => handleChange("rut", e.target.value)}
                onBlur={handleRutBlur}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="mt-1 text-xs text-gray-500">
                Validaremos que el RUT sea correcto (incluyendo dígito verificador).
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="tucorreo@gmail.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de usuario
              </label>
              <select
                value={form.userType}
                onChange={(e) => handleChange("userType", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option>Comprador frecuente</option>
                <option>Vendedor frecuente</option>
                <option>Ambos (comprar y vender)</option>
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
                onChange={(e) => handleChange("password", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                onChange={(e) => handleChange("passwordConfirm", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* ✅ Términos y condiciones (OBLIGATORIO) */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAcceptTerms(checked);
                    if (checked) setErrorMessage("");
                  }}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                />
                <span className="text-sm text-gray-700 leading-5">
                  He leído y acepto los{" "}
                  <Link
                    href="/legal/terms"
                    target="_blank"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Términos y Condiciones
                  </Link>{" "}
                  de TixSwap.
                </span>
              </label>
              <p className="mt-2 text-xs text-gray-500">
                Si no aceptas los Términos, no podrás crear tu cuenta.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !acceptTerms}
              className={`w-full rounded-xl px-4 py-3 font-semibold text-white transition ${
                loading || !acceptTerms
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Creando..." : "Crear cuenta"}
            </button>

            <p className="text-sm text-gray-600 text-center">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
