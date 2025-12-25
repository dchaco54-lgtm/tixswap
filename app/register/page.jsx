"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "../lib/supabaseClient";
import { validateRut, sanitizeRut } from "../lib/rutUtils";

const DEFAULT_ROLE = "basic";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const feedbackRef = useRef(null);

  const isFormComplete = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      rut.trim().length >= 8 &&
      email.trim().length >= 5 &&
      phone.trim().length >= 8 &&
      password.length >= 6 &&
      password2.length >= 6
    );
  }, [fullName, rut, email, phone, password, password2]);

  const canSubmit = useMemo(() => {
    return acceptTerms && isFormComplete && !isSubmitting;
  }, [acceptTerms, isFormComplete, isSubmitting]);

  const scrollToFeedback = () => {
    // Para que SIEMPRE veas el error/ok aunque estés scrolleado abajo
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    setErrorMessage("");
    setSuccessMessage("");

    // Validaciones UX (rápidas y claras)
    if (!acceptTerms) {
      setErrorMessage("Debes aceptar los Términos y Condiciones para crear tu cuenta.");
      scrollToFeedback();
      return;
    }

    if (!isFormComplete) {
      setErrorMessage("Completa todos los campos para continuar.");
      scrollToFeedback();
      return;
    }

    if (password !== password2) {
      setErrorMessage("Las contraseñas no coinciden.");
      scrollToFeedback();
      return;
    }

    if (!validateRut(rut)) {
      setErrorMessage("RUT inválido. Revisa el formato y el dígito verificador.");
      scrollToFeedback();
      return;
    }

    const rutSanitized = sanitizeRut(rut);

    try {
      setIsSubmitting(true);

      // 1) Crear usuario en Auth (email confirm)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            rut: rutSanitized,
            phone: phone.trim(),
            role: DEFAULT_ROLE,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });

      if (error) {
        setErrorMessage(error.message || "No se pudo crear la cuenta. Intenta nuevamente.");
        scrollToFeedback();
        return;
      }

      // 2) Intentar upsert en profiles (NO BLOQUEAR si falla por RLS)
      // OJO: si tu proyecto exige confirmación de email, aquí muchas veces NO hay sesión aún.
      if (data?.user?.id) {
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            email: email.trim(),
            full_name: fullName.trim(),
            rut: rutSanitized,
            phone: phone.trim(),
            role: DEFAULT_ROLE,
            status: "active",
          },
          { onConflict: "id" }
        );

        // Si falla, NO detenemos el registro (el usuario ya quedó creado en Auth)
        if (profileError) {
          // Puedes mirar esto en consola si quieres, pero al usuario no le bloqueamos el flujo
          console.warn("profiles.upsert falló (probable RLS / sin sesión):", profileError.message);
        }
      }

      setSuccessMessage("¡Cuenta creada! Te enviamos un correo para validar tu email ✅");
      scrollToFeedback();

      // Redirigir a login después de un ratito
      setTimeout(() => {
        router.push("/login");
      }, 1800);
    } catch (err) {
      setErrorMessage("Ocurrió un error inesperado. Intenta nuevamente.");
      scrollToFeedback();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Contenedor */}
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm border">
          <h1 className="text-2xl font-semibold text-gray-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-gray-600">
            Regístrate para comprar y vender entradas de forma segura.
          </p>

          {/* Feedback SIEMPRE cerca del botón */}
          <div ref={feedbackRef} className="mt-4">
            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
              <input
                className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: David Chacón"
                autoComplete="name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">RUT</label>
              <input
                className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="Ej: 12.345.678-9"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Validaremos que el RUT sea correcto (incluyendo dígito verificador).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
              <input
                className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+569XXXXXXXX"
                autoComplete="tel"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Repetir contraseña</label>
              <input
                className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                required
              />
            </div>

            {/* Terms */}
            <div className="pt-1">
              <label className="flex items-start gap-3 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  He leído y acepto los{" "}
                  <Link
                    href="/terms"
                    className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Términos y Condiciones
                  </Link>{" "}
                  de TixSwap.
                  <span className="block mt-1 text-xs text-gray-500">
                    Si no aceptas los Términos, no podrás crear tu cuenta.
                  </span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full rounded-xl px-4 py-3 text-white font-semibold transition ${
                canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <p className="text-center text-sm text-gray-600">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
