"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import PasswordField from "@/components/PasswordField";
import { PASSWORD_POLICY } from "@/lib/security/passwordPolicy";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeFormData,
  validateRegisterForm,
} from "@/lib/validations";

const DEFAULT_USER_TYPE = "standard";
const DEFAULT_SELLER_TIER = "basic";

export default function RegisterPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/dashboard");

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get("redirectTo") || "/dashboard");
  }, []);

  const validation = validateRegisterForm({
    fullName,
    rut,
    email,
    phone,
    password,
    confirmPassword,
    acceptedTerms,
  });
  const canSubmit = !loading;

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const normalized = normalizeFormData({ fullName, rut, email, phone });

    try {
      setLoading(true);

      const policyRes = await fetch("/api/auth/password-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, context: "signup" }),
      });
      const policyJson = await policyRes.json().catch(() => ({}));

      if (!policyRes.ok || !policyJson?.valid) {
        setErrors({
          password:
            policyJson?.message ||
            "La contraseña no cumple la política de seguridad.",
        });
        return;
      }

      const emailCheckRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized.email }),
      });
      const emailCheckJson = await emailCheckRes.json().catch(() => ({}));

      if (emailCheckRes.ok && emailCheckJson?.exists) {
        setErrors({
          email:
            "Ese correo ya tiene una cuenta en TixSwap. Inicia sesión con tu correo y contraseña.",
        });
        return;
      }

      const rutCheckRes = await fetch("/api/auth/check-rut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: normalized.rut }),
      });
      const rutCheckJson = await rutCheckRes.json().catch(() => ({}));

      if (rutCheckRes.ok && rutCheckJson?.exists) {
        setErrors({
          rut: "Ese RUT ya está registrado en otra cuenta.",
        });
        return;
      }

      const authBaseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "https://www.tixswap.cl")
      ).replace(/\/+$/, "");
      const callbackUrl = `${authBaseUrl}/auth/callback?redirectTo=${encodeURIComponent(
        redirectTo
      )}`;

      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
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
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.user && !data?.session) {
        router.push(`/verify-email?email=${encodeURIComponent(normalized.email)}`);
        return;
      }

      router.push(redirectTo);
    } catch (error) {
      setErrors({
        submit: error?.message || "No se pudo crear la cuenta.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_34%),linear-gradient(160deg,#0f172a_0%,#172554_55%,#1d4ed8_100%)] px-10 py-12 text-white lg:block">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              Volver al inicio
            </Link>

            <div className="mt-12 max-w-md">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                Registro clásico
              </div>

              <h1 className="mt-5 text-4xl font-black leading-tight">
                Crea tu cuenta con tus datos desde el inicio.
              </h1>

              <p className="mt-4 text-base leading-7 text-blue-100">
                Completa nombre, RUT, teléfono, correo y contraseña para dejar tu
                cuenta lista desde el primer acceso.
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                  <div className="text-sm font-semibold">Cuenta lista al tiro</div>
                  <div className="mt-1 text-sm text-blue-100">
                    Tus datos principales quedan cargados desde el registro.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                  <div className="text-sm font-semibold">Validación más clara</div>
                  <div className="mt-1 text-sm text-blue-100">
                    Evitamos cuentas incompletas antes de comprar, vender o chatear.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link
                href="/"
                className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
              >
                ← Volver
              </Link>
              <span className="text-sm font-semibold text-blue-700">TixSwap</span>
            </div>

            <div className="mx-auto w-full max-w-md">
              <div className="mb-6">
                <div className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Cuenta nueva
                </div>
                <h2 className="mt-4 text-3xl font-black text-slate-900">
                  Crear cuenta
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ingresa tus datos para dejar tu cuenta configurada desde el comienzo.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ej: Juan Pérez Soto"
                    className="tix-input"
                    autoComplete="name"
                    disabled={loading}
                  />
                  {errors.fullName ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.fullName}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      RUT
                    </label>
                    <input
                      type="text"
                      value={rut}
                      onChange={(event) => setRut(event.target.value)}
                      placeholder="12.345.678-9"
                      className="tix-input"
                      autoComplete="off"
                      disabled={loading}
                    />
                    {errors.rut ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.rut}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+56 9 1234 5678"
                      className="tix-input"
                      autoComplete="tel"
                      disabled={loading}
                    />
                    {errors.phone ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Usa un celular chileno en formato +56 9XXXXXXXX.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@correo.cl"
                    className="tix-input"
                    autoComplete="email"
                    disabled={loading}
                  />
                  {errors.email ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.email}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Contraseña
                  </label>
                  <PasswordField
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Crea una contraseña segura"
                    inputClassName="tix-input"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    name="password"
                    id="password"
                  />
                  {errors.password ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.password}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      Mínimo {PASSWORD_POLICY.MIN_LEN} caracteres, con mayúscula,
                      minúscula, número y símbolo.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Confirma tu contraseña
                  </label>
                  <PasswordField
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repite tu contraseña"
                    inputClassName="tix-input"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    name="confirmPassword"
                    id="confirmPassword"
                  />
                  {errors.confirmPassword ? (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.confirmPassword}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-start gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      className="mt-1"
                      disabled={loading}
                    />
                    <span>
                      Acepto los{" "}
                      <Link href="/legal/terms" className="font-semibold text-blue-700 hover:underline">
                        Términos y Condiciones
                      </Link>{" "}
                      de TixSwap.
                    </span>
                  </label>
                  {errors.terms ? (
                    <p className="mt-2 text-xs text-rose-600">{errors.terms}</p>
                  ) : null}
                </div>

                {errors.submit ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errors.submit}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Te pedimos nombre, RUT y teléfono desde el registro para dejar tu
                cuenta lista y evitar pasos extra después.
              </div>

              <p className="mt-6 text-center text-sm text-slate-500">
                ¿Ya tienes cuenta?{" "}
                <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="font-semibold text-blue-700 hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
