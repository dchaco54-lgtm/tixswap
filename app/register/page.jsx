"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { formatRut, isValidRut } from "../lib/rutUtils";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normalizeRutForDb = (rutAny) => {
    const clean = String(rutAny || "")
      .replace(/\./g, "")
      .replace(/\s/g, "")
      .toUpperCase();

    if (!clean.includes("-") && clean.length >= 2) {
      const body = clean.slice(0, -1);
      const dv = clean.slice(-1);
      return `${body}-${dv}`;
    }
    return clean;
  };

  const isFakeRut = (rutNormalized) => {
    const body = (rutNormalized || "").split("-")[0] || "";
    return /^(\d)\1+$/.test(body); // 11111111, 22222222, etc.
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!acceptedTerms) {
      setError("Debes aceptar los Términos y Condiciones.");
      return;
    }

    if (!fullName.trim()) {
      setError("Debes ingresar tu nombre.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const rutFormatted = formatRut(rut);
    const rutNormalized = normalizeRutForDb(rutFormatted);

    if (!isValidRut(rutFormatted)) {
      setError("RUT inválido. Revisa el formato y el dígito verificador.");
      return;
    }

    if (isFakeRut(rutNormalized)) {
      setError("RUT no válido por razones de seguridad.");
      return;
    }

    try {
      setLoading(true);

      // 1) Validar si el RUT ya existe en BD (profiles)
      const { data: existingProfile, error: rutCheckError } = await supabase
        .from("profiles")
        .select("id")
        .in("rut", [rutFormatted, rutNormalized])
        .limit(1);

      if (rutCheckError) throw rutCheckError;

      if (Array.isArray(existingProfile) && existingProfile.length > 0) {
        setError("Rut ya con cuenta en Tixswap, debes iniciar sesión");
        return;
      }

      // 2) Crear cuenta (Supabase manda correo si Confirm Email está ON)
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            rut: rutNormalized,
            phone: phone,
          },
          emailRedirectTo: redirectTo,
        },
      });

      if (signUpError) {
        const msg = (signUpError.message || "").toLowerCase();
        if (msg.includes("redirect") && msg.includes("not allowed")) {
          throw new Error(
            "El link de confirmación no se pudo generar (redirect no permitido). Revisa en Supabase: Auth → URL Configuration (Site URL / Redirect URLs)."
          );
        }
        throw signUpError;
      }

      // Caso SaaS típico: user creado pero sin sesión -> esperar confirmación
      if (data?.user && !data?.session) {
        // redirigimos a pantalla de verificación
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      // Si por algún motivo quedó logeado inmediatamente
      setMessage("¡Cuenta creada y sesión iniciada!");
      setFullName("");
      setRut("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setAcceptedTerms(false);
    } catch (err) {
      setError(err?.message || "Ocurrió un error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7ff] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Crear cuenta</h1>
        <p className="text-center text-gray-500 mb-6">
          Validaremos que el RUT sea correcto (incluyendo dígito verificador).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Perez"
              className="w-full bg-[#eaf2ff] rounded-xl px-4 py-3 outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">RUT</label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
              className="w-full bg-[#eaf2ff] rounded-xl px-4 py-3 outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full bg-[#eaf2ff] rounded-xl px-4 py-3 outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+56912345678"
              className="w-full bg-[#eaf2ff] rounded-xl px-4 py-3 outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border rounded-xl px-4 py-3 outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Repetir contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white border rounded-xl px-4 py-3 outline-none"
              required
              disabled={loading}
            />
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
              required
              disabled={loading}
            />
            <div className="text-sm">
              <p>
                He leído y acepto los{" "}
                <a href="/terminos" className="text-blue-600 hover:underline">
                  Términos y Condiciones
                </a>{" "}
                de TixSwap.
              </p>
              <p className="text-gray-400">
                Si no aceptas los Términos, no podrás crear tu cuenta.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="w-full rounded-xl py-3 font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          {/* ✅ Mensajes abajo del botón (UX correcto) */}
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              {message}
            </div>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Iniciar sesión
          </a>
        </p>
      </div>
    </div>
  );
}


