"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { isValidRut, normalizeRut, formatRut } from "../lib/rutUtils";

export default function RegisterPage() {
  const supabase = createClientComponentClient();

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const cleanPhone = (value = "") =>
    String(value).replace(/[^\d+]/g, "").slice(0, 20);

  const handleRutBlur = () => {
    // deja bonito el RUT (17.684.316-0)
    if (rut?.trim()) setRut(formatRut(rut));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!accepted) {
      setErrorMsg("Debes aceptar los Términos y Condiciones.");
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg("Ingresa tu nombre completo.");
      return;
    }

    const rutNorm = normalizeRut(rut);
    if (!rutNorm || !isValidRut(rutNorm)) {
      setErrorMsg("El RUT no es válido. Revisa el dígito verificador.");
      return;
    }

    const phoneClean = cleanPhone(phone);
    if (!phoneClean || phoneClean.length < 8) {
      setErrorMsg("Ingresa un teléfono válido.");
      return;
    }

    if (!email.trim()) {
      setErrorMsg("Ingresa tu correo.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== password2) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            rut: rutNorm,
            phone: phoneClean,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || "Error creando usuario.");
        setLoading(false);
        return;
      }

      // Si Supabase tiene email confirmation ON, normalmente:
      // - data.user existe
      // - data.session es null hasta que confirme el mail
      setSuccessMsg(
        "¡Listo! Te enviamos un correo para confirmar tu cuenta. Revisa spam/promociones si no aparece."
      );

      // opcional: limpiar form
      setFullName("");
      setRut("");
      setPhone("");
      setEmail("");
      setPassword("");
      setPassword2("");
      setAccepted(false);
    } catch (err) {
      setErrorMsg(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FF]">
      {/* Header */}
      <header className="w-full bg-white border-b border-[#E5ECFF]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl font-bold text-[#1E5BFF]">TixSwap</span>
            <span className="text-sm text-gray-500 hidden sm:block">
              Reventa segura, en un clic
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-700">
            <Link href="/buy" className="hover:text-[#1E5BFF]">
              Comprar
            </Link>
            <Link href="/sell" className="hover:text-[#1E5BFF]">
              Vender
            </Link>
            <Link href="/saber-mas" className="hover:text-[#1E5BFF]">
              Cómo funciona
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full border border-[#D6E2FF] text-[#1E5BFF] hover:bg-[#F2F6FF]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-full bg-[#1E5BFF] text-white hover:bg-[#164BDB]"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-[#E5ECFF] p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Crear cuenta
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Validaremos que el RUT sea correcto (incluyendo dígito verificador).
          </p>

          {errorMsg ? (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {errorMsg}
            </div>
          ) : null}

          {successMsg ? (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              {successMsg}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#EEF5FF] border border-[#D6E2FF] outline-none focus:ring-2 focus:ring-[#1E5BFF]/30"
                placeholder="Ej: David Chacón Pérez"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT
              </label>
              <input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                onBlur={handleRutBlur}
                className="w-full px-4 py-3 rounded-xl bg-[#EEF5FF] border border-[#D6E2FF] outline-none focus:ring-2 focus:ring-[#1E5BFF]/30"
                placeholder="Ej: 17.684.316-0"
                inputMode="text"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#EEF5FF] border border-[#D6E2FF] outline-none focus:ring-2 focus:ring-[#1E5BFF]/30"
                placeholder="tucorreo@ejemplo.com"
                type="email"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(cleanPhone(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-[#EEF5FF] border border-[#D6E2FF] outline-none focus:ring-2 focus:ring-[#1E5BFF]/30"
                placeholder="+569XXXXXXXX"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#D6E2FF] outline-none focus:ring-2 focus:ring-[#1E5BFF]/30"
                type="password"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repetir contraseña
              </label>
              <input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#D6E2FF] outline-none focus:ring-2 focus:ring-[#1E5BFF]/30"
                type="password"
                autoComplete="new-password"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                He leído y acepto los{" "}
                <Link href="/terms" className="text-[#1E5BFF] hover:underline">
                  Términos y Condiciones
                </Link>{" "}
                de TixSwap.
                <div className="text-xs text-gray-500 mt-1">
                  Si no aceptas los Términos, no podrás crear tu cuenta.
                </div>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-4 py-3 rounded-xl bg-[#1E5BFF] text-white font-semibold hover:bg-[#164BDB] disabled:opacity-60"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <p className="text-sm text-gray-600 text-center pt-2">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-[#1E5BFF] hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}


