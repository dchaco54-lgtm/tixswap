"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  normalizeRut,
  isValidRut,
  isSuspiciousRut,
  isValidEmail,
  isValidPhoneCL,
  normalizePhoneCL,
  normalizeFormData,
  validateRegisterForm,
} from "@/lib/validations";

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
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const DEFAULT_USER_TYPE = "standard";
  const DEFAULT_SELLER_TIER = "basic";

  // ============================================
  // VALIDACIÓN EN TIEMPO REAL (onBlur)
  // ============================================

  const validateField = (fieldName, value) => {
    const newErrors = { ...errors };

    switch (fieldName) {
      case "fullName":
        if (!value.trim()) {
          newErrors.fullName = "Debes ingresar tu nombre";
        } else {
          delete newErrors.fullName;
        }
        break;

      case "rut":
        if (!value.trim()) {
          newErrors.rut = "Debes ingresar tu RUT";
        } else if (!isValidRut(value)) {
          newErrors.rut = "RUT inválido. Revisa el formato y dígito verificador";
        } else if (isSuspiciousRut(normalizeRut(value))) {
          newErrors.rut = "RUT no válido por razones de seguridad";
        } else {
          delete newErrors.rut;
        }
        break;

      case "email":
        if (!value.trim()) {
          newErrors.email = "Debes ingresar un correo";
        } else if (!isValidEmail(value)) {
          newErrors.email = "Correo inválido. Ej: nombre@dominio.cl";
        } else {
          delete newErrors.email;
        }
        break;

      case "phone":
        if (!value.trim()) {
          newErrors.phone = "Debes ingresar un teléfono";
        } else if (!isValidPhoneCL(value)) {
          newErrors.phone = "Teléfono inválido. Debe ser: +56 9XXXXXXXX";
        } else {
          delete newErrors.phone;
        }
        break;

      case "password":
        if (!value) {
          newErrors.password = "Debes ingresar una contraseña";
        } else if (value.length < 6) {
          newErrors.password = "La contraseña debe tener al menos 6 caracteres";
        } else {
          delete newErrors.password;
        }
        break;

      case "confirmPassword":
        if (!value) {
          newErrors.confirmPassword = "Debes confirmar la contraseña";
        } else if (value !== password) {
          newErrors.confirmPassword = "Las contraseñas no coinciden";
        } else {
          delete newErrors.confirmPassword;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleBlur = (fieldName, value) => {
    setTouched({ ...touched, [fieldName]: true });
    validateField(fieldName, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // Validar todos los campos
    const validation = validateRegisterForm({
      fullName,
      rut,
      email,
      phone,
      password,
      confirmPassword,
      acceptedTerms,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    // Si llegó aquí, todos los campos son válidos
    const normalized = normalizeFormData({ fullName, rut, email, phone });

    try {
      setLoading(true);
      setErrors({});

      // Validar RUT duplicado en backend
      const rutCheckRes = await fetch("/api/auth/check-rut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: normalized.rut }),
      });

      const rutCheck = await rutCheckRes.json();

      if (!rutCheckRes.ok) {
        throw new Error(rutCheck?.error || "No se pudo validar el RUT.");
      }

      if (rutCheck?.exists) {
        setErrors({
          rut: "RUT ya registrado. Si necesitas ayuda, contáctanos por soporte.",
        });
        return;
      }

      // Crear cuenta
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "https://tixswap.cl/auth/callback";

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalized.email,
        password,
        options: {
          data: {
            full_name: normalized.fullName,
            rut: normalized.rut,
            phone: normalized.phone,
            user_type: DEFAULT_USER_TYPE,
            seller_tier: DEFAULT_SELLER_TIER,
          },
          emailRedirectTo: redirectTo,
        },
      });

      console.log("[Register] SignUp response:", {
        user: data?.user?.id,
        error: signUpError,
      });

      if (signUpError) {
        console.error("[Register] SignUp error:", signUpError);
        throw signUpError;
      }

      // SaaS flow: user creado pero sin sesión => email confirm
      if (data?.user && !data?.session) {
        router.push(
          `/verify-email?email=${encodeURIComponent(normalized.email)}`
        );
        return;
      }

      setMessage("¡Cuenta creada y sesión iniciada!");
      setFullName("");
      setRut("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setAcceptedTerms(false);
      setTouched({});
    } catch (err) {
      setErrors({
        submit: err?.message || "Ocurrió un error al crear la cuenta.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7ff] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Crear cuenta</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          Completa todos los campos. Validaremos tu RUT (incluyendo dígito verificador).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => handleBlur("fullName", fullName)}
              placeholder="Juan Perez"
              className={`w-full rounded-xl px-4 py-3 outline-none transition ${
                touched.fullName && errors.fullName
                  ? "bg-red-50 border border-red-300"
                  : "bg-[#eaf2ff]"
              }`}
              required
              disabled={loading}
            />
            {touched.fullName && errors.fullName && (
              <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* RUT */}
          <div>
            <label className="block text-sm font-medium mb-1">RUT</label>
            <input
              type="text"
              value={rut}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setRut(val);
              }}
              onBlur={() => handleBlur("rut", rut)}
              placeholder="12.345.678-9"
              className={`w-full rounded-xl px-4 py-3 outline-none transition ${
                touched.rut && errors.rut
                  ? "bg-red-50 border border-red-300"
                  : "bg-[#eaf2ff]"
              }`}
              required
              disabled={loading}
            />
            {touched.rut && errors.rut && (
              <p className="text-red-600 text-xs mt-1">{errors.rut}</p>
            )}
            {!errors.rut && rut && isValidRut(rut) && touched.rut && (
              <p className="text-green-600 text-xs mt-1">✓ RUT válido</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur("email", email)}
              placeholder="correo@ejemplo.com"
              className={`w-full rounded-xl px-4 py-3 outline-none transition ${
                touched.email && errors.email
                  ? "bg-red-50 border border-red-300"
                  : "bg-[#eaf2ff]"
              }`}
              required
              disabled={loading}
            />
            {touched.email && errors.email && (
              <p className="text-red-600 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const val = e.target.value;
                // Permitir que el usuario escriba libremente, normalizar al blur
                setPhone(val);
              }}
              onFocus={(e) => {
                // Si está vacío, prellenar +56 9
                if (!phone) {
                  setPhone("+56 9");
                }
              }}
              onBlur={() => {
                // Normalizar teléfono al blur
                if (phone) {
                  const normalized = normalizePhoneCL(phone);
                  if (normalized) {
                    // Mostrar con espacios para mejor UX
                    setPhone(normalized.replace(/(\d)(\d{8})$/, "+56 $1$2"));
                  }
                }
                handleBlur("phone", phone);
              }}
              placeholder="+56 912345678"
              className={`w-full rounded-xl px-4 py-3 outline-none transition ${
                touched.phone && errors.phone
                  ? "bg-red-50 border border-red-300"
                  : "bg-[#eaf2ff]"
              }`}
              required
              disabled={loading}
            />
            {touched.phone && errors.phone && (
              <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
            )}
            <p className="text-gray-400 text-xs mt-1">
              Ej: 963528995 o +56 9 63528995
            </p>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur("password", password)}
              placeholder="Mínimo 6 caracteres"
              className={`w-full rounded-xl px-4 py-3 outline-none transition ${
                touched.password && errors.password
                  ? "bg-red-50 border border-red-300"
                  : "bg-white border border-gray-200"
              }`}
              required
              disabled={loading}
            />
            {touched.password && errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Repetir Contraseña */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Repetir contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => handleBlur("confirmPassword", confirmPassword)}
              className={`w-full rounded-xl px-4 py-3 outline-none transition ${
                touched.confirmPassword && errors.confirmPassword
                  ? "bg-red-50 border border-red-300"
                  : "bg-white border border-gray-200"
              }`}
              required
              disabled={loading}
            />
            {touched.confirmPassword && errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Términos */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) {
                  setErrors({ ...errors });
                  delete errors.terms;
                }
              }}
              className="mt-1"
              required
              disabled={loading}
            />
            <div className="text-sm">
              <p>
                He leído y acepto los{" "}
                <a href="/legal/terms" className="text-blue-600 hover:underline">
                  Términos y Condiciones
                </a>{" "}
                de TixSwap.
              </p>
              <p className="text-gray-400">
                Si no aceptas los Términos, no podrás crear tu cuenta.
              </p>
            </div>
          </div>
          {errors.terms && (
            <p className="text-red-600 text-xs">{errors.terms}</p>
          )}

          {/* Botón Submit */}
          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="w-full rounded-xl py-3 font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          {/* Errores Generales */}
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Mensaje de Éxito */}
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

