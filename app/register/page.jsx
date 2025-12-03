"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    rut: "",
    email: "",
    phone: "",
    userType: "Usuario general",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (field) => (e) => {
    const value =
      field === "termsAccepted" ? e.target.checked : e.target.value;

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (form.password !== form.confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    if (!form.termsAccepted) {
      setErrorMsg(
        "Debes aceptar los términos y condiciones para crear tu cuenta."
      );
      return;
    }

    setLoading(true);

    // Si Supabase no está configurado, no intentamos registrar
    if (!supabase) {
      setLoading(false);
      setErrorMsg("El servicio de registro aún no está configurado.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          rut: form.rut,
          phone: form.phone,
          user_type: form.userType,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "Ocurrió un error al crear la cuenta.");
      return;
    }

    setSuccessMsg(
      "Cuenta creada correctamente. Revisa tu correo para confirmar la cuenta."
    );

    // Si quieres redirigir automáticamente al login después:
    // setTimeout(() => router.push("/login"), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-soft p-8">
        <h1 className="text-3xl font-bold text-center mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Únete al marketplace más seguro de Chile
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre completo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              required
              placeholder="Tu nombre completo"
              value={form.name}
              onChange={handleChange("name")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb]"
            />
          </div>

          {/* RUT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT
            </label>
            <input
              type="text"
              required
              placeholder="12.345.678-9"
              value={form.rut}
              onChange={handleChange("rut")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ri
