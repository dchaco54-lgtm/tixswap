"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// --- Helpers para RUT chileno ---

function normalizeRut(rutRaw) {
  const clean = rutRaw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const bodyNumber = parseInt(body, 10);
  if (Number.isNaN(bodyNumber)) return clean;

  return `${bodyNumber.toString()}-${dv}`;
}

function isValidRut(rutRaw) {
  const clean = rutRaw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!clean || clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^[0-9]+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const expected = 11 - remainder;

  let dvExpected;
  if (expected === 11) dvExpected = "0";
  else if (expected === 10) dvExpected = "K";
  else dvExpected = String(expected);

  return dv === dvExpected;
}

// --- Página de registro ---

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

    const normalizedRut = normalizeRut(rut.trim());

    if (!isValidRut(normalizedRut)) {
      setErrorMessage(
        "El RUT ingresado no es válido. Verifica el número y el dígito verificador."
      );
      return;
    }

    setLoading(true);

    try {
      // Revisar si el RUT ya existe
      const {
        data: rutExists,
        error: rutCheckError,
      } = await supabase.rpc("rut_exists", {
        rut_input: normalizedRut,
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

      // Registro normal
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName.trim(),
            full_name: fullName.trim(),
            rut: normalizedRut,
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

