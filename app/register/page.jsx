"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import PasswordField from "@/components/PasswordField";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import { PASSWORD_POLICY } from "@/lib/security/passwordPolicy";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, validatePasswordStrength } from "@/lib/validations";

const DEFAULT_USER_TYPE = "standard";
const DEFAULT_SELLER_TIER = "basic";

export default function RegisterPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [socialError, setSocialError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get("redirectTo") || "/dashboard");
  }, []);

  const passwordValidation = validatePasswordStrength(password);
  const canSubmit =
    !loading &&
    acceptedTerms &&
    isValidEmail(email) &&
    passwordValidation.valid;

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setSocialError("");

    const nextErrors = {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      nextErrors.email = "Debes ingresar tu correo.";
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = "Correo inválido. Revisa el formato.";
    }

    if (!password) {
      nextErrors.password = "Debes ingresar una contraseña.";
    } else if (!passwordValidation.valid) {
      nextErrors.password = passwordValidation.message;
    }

    if (!acceptedTerms) {
      nextErrors.terms = "Debes aceptar los Términos y Condiciones.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

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
        email: normalizedEmail,
        password,
        options: {
          data: {
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
        router.push(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
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
                Registro simple
              </div>

              <h1 className="mt-5 text-4xl font-black leading-tight">
                Entra rápido. Verifica tus datos solo cuando realmente importe.
              </h1>

              <p className="mt-4 text-base leading-7 text-blue-100">
                Crea tu cuenta con correo o acceso social. Nombre, RUT y teléfono
                quedan para el momento de comprar, vender o usar funciones de confianza.
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                  <div className="text-sm font-semibold">Menos fricción al entrar</div>
                  <div className="mt-1 text-sm text-blue-100">
                    Solo te pedimos lo esencial para activar tu cuenta.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                  <div className="text-sm font-semibold">Seguridad donde corresponde</div>
                  <div className="mt-1 text-sm text-blue-100">
                    Validamos identidad antes de transacciones, publicaciones y chat.
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
                  Empieza en segundos. Los datos de verificación te los pediremos
                  solo antes de acciones sensibles.
                </p>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-slate-700">
                  Iniciar sesión con
                </div>
                <SocialAuthButtons
                  redirectTo={redirectTo}
                  onError={(message) => setSocialError(message)}
                />
                {socialError ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {socialError}
                  </div>
                ) : null}
              </div>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  o crea tu cuenta con correo
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                No te pediremos nombre, RUT ni teléfono al inicio. Eso aparece solo
                antes de comprar, vender o usar el chat.
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
