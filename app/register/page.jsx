"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatRut, isValidRut } from "../lib/rutUtils";

export default function RegisterPage() {
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!acceptedTerms) {
      setError("Debes aceptar los Términos y Condiciones.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const rutFormatted = formatRut(rut);

    // OJO: en tu proyecto la validación real es isValidRut()
    if (!isValidRut(rutFormatted)) {
      setError("RUT inválido. Revisa el formato y el dígito verificador.");
      return;
    }

    try {
      setLoading(true);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            rut: rutFormatted,
            phone: phone,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Cuando email confirmations están activadas, Supabase manda correo de confirmación.
      // Si están desactivadas, el usuario queda confirmado al tiro.
      if (data?.user && !data?.session) {
        setMessage(
          "¡Cuenta creada! Revisa tu correo para confirmar tu cuenta (incluye spam)."
        );
      } else {
        setMessage("¡Cuenta creada y sesión iniciada!");
      }

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

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">RUT</label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
              className="w-full bg-[#eaf2ff] rounded-xl px-4 py-3 outline-none"
              required
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
            />
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
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
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
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
