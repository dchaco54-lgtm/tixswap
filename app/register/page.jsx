"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isValidRut, normalizeRut } from "../lib/rutUtils";

const USER_TYPES = [
  "Usuario general",
  "Comprador frecuente",
  "Vendedor frecuente",
  "Premium",
];

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

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSubmitDisabled = useMemo(() => {
    return loading || !acceptTerms;
  }, [loading, acceptTerms]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Ingresa tu nombre completo.";
    if (!form.rut.trim()) nextErrors.rut = "Ingresa tu RUT.";
    if (form.rut.trim() && !isValidRut(form.rut)) nextErrors.rut = "El RUT ingresado no es válido.";

    if (!form.email.trim()) nextErrors.email = "Ingresa tu correo.";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      nextErrors.email = "El correo no tiene formato válido.";

    if (!form.phone.trim()) nextErrors.phone = "Ingresa tu teléfono.";
    if (!form.password) nextErrors.password = "Ingresa una contraseña.";
    if (form.password && form.password.length < 6)
      nextErrors.password = "La contraseña debe tener al menos 6 caracteres.";

    if (!form.passwordConfirm) nextErrors.passwordConfirm = "Repite tu contraseña.";
    if (form.password && form.passwordConfirm && form.password !== form.passwordConfirm)
      nextErrors.passwordConfirm = "Las contraseñas no coinciden.";

    if (!acceptTerms) nextErrors.acceptTerms = "Debes aceptar los Términos y Condiciones para registrarte.";

    return nextErrors;
  }

  async function handleSubmit(e) {
    // 🔥 CLAVE: que NUNCA muera por event undefined
    e?.preventDefault?.();

    setErrorMessage("");
    setSuccessMessage("");

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setErrorMessage("Revisa los campos marcados antes de continuar.");
      return;
    }

    const normalizedRut = normalizeRut(form.rut);

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            rut: normalizedRut,
            phone: form.phone.trim(),
            userType: form.userType,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("already registered") || msg.includes("already exists")) {
          setErrorMessage(
            "Este correo ya tiene una cuenta en TixSwap. Intenta iniciar sesión o recupera tu contraseña."
          );
        } else {
          setErrorMessage("Ocurrió un problema al crear tu cuenta. Inténtalo nuevamente.");
        }
        return;
      }

      if (data?.user) {
        setSuccessMessage(
          "Cuenta creada ✅ Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja o spam."
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
        setAcceptTerms(false);

        // Si quieres, lo mandamos directo al login después de 2.5s:
        setTimeout(() => router.push("/login"), 2500);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Ocurrió un problema al crear tu cuenta. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-gray-600">
            Regístrate para comprar y vender entradas de forma segura.
          </p>

          {(errorMessage || successMessage) && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                successMessage
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {successMessage || errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                  errors.fullName ? "border-red-300" : "border-gray-200"
                }`}
                placeholder="Ej: David Chacón"
                autoComplete="name"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">RUT</label>
              <input
                name="rut"
                value={form.rut}
                onChange={handleChange}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                  errors.rut ? "border-red-300" : "border-gray-200"
                }`}
                placeholder="Ej: 12.345.678-5"
                inputMode="text"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Validaremos que el RUT sea correcto (incluyendo dígito verificador).
              </p>
              {errors.rut && <p className="mt-1 text-xs text-red-600">{errors.rut}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                  errors.email ? "border-red-300" : "border-gray-200"
                }`}
                placeholder="tucorreo@gmail.com"
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                  errors.phone ? "border-red-300" : "border-gray-200"
                }`}
                placeholder="+569XXXXXXXX"
                autoComplete="tel"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo de usuario
              </label>
              <select
                name="userType"
                value={form.userType}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                {USER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                  errors.password ? "border-red-300" : "border-gray-200"
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Repetir contraseña
              </label>
              <input
                type="password"
                name="passwordConfirm"
                value={form.passwordConfirm}
                onChange={handleChange}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                  errors.passwordConfirm ? "border-red-300" : "border-gray-200"
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {errors.passwordConfirm && (
                <p className="mt-1 text-xs text-red-600">{errors.passwordConfirm}</p>
              )}
            </div>

            {/* ✅ Terms */}
            <div className="pt-1">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked);
                    setErrors((prev) => ({ ...prev, acceptTerms: "" }));
                    setErrorMessage("");
                  }}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <span>
                  He leído y acepto los{" "}
                  <Link
                    href="/terms"
                    className="font-medium text-blue-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Términos y Condiciones
                  </Link>{" "}
                  de TixSwap.
                  <span className="mt-1 block text-xs text-gray-500">
                    Si no aceptas los Términos, no podrás crear tu cuenta.
                  </span>
                </span>
              </label>
              {errors.acceptTerms && (
                <p className="mt-2 text-xs text-red-600">{errors.acceptTerms}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                isSubmitDisabled ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Creando..." : "Crear cuenta"}
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
    </div>
  );
}
