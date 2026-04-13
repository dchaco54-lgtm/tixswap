"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const PROVIDERS = [
  { id: "google", label: "Continuar con Google" },
  { id: "facebook", label: "Continuar con Facebook" },
  { id: "apple", label: "Continuar con Apple" },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.2 2.9-7.1 0-.7-.1-1.4-.2-2.1H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.3-4H3.5v2.5A9.9 9.9 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.7 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H3.5A9.9 9.9 0 0 0 2.4 12c0 1.6.4 3 1.1 4.5L6.7 14Z"
      />
      <path
        fill="#4285F4"
        d="M12 6c1.4 0 2.6.5 3.6 1.4L18.3 5A9.8 9.8 0 0 0 3.5 7.5L6.7 10c.7-2.3 2.8-4 5.3-4Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.9 11.8v-8.3H7.1V12h3V9.4c0-3 1.8-4.6 4.4-4.6 1.3 0 2.6.2 2.6.2V8h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.3A12 12 0 0 0 24 12Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 12.6c0-2 1.7-3 1.8-3.1-1-1.4-2.5-1.6-3.1-1.6-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2-1.5 2.5-.4 6.3 1 8.3.7 1 1.5 2.1 2.7 2 .9 0 1.3-.6 2.5-.6s1.6.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2-.8-2-3.3Zm-2.1-6c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.8-1 2.9 1 0 2-.5 2.6-1.2Z"
      />
    </svg>
  );
}

function ProviderIcon({ providerId }) {
  if (providerId === "google") return <GoogleIcon />;
  if (providerId === "facebook") return <FacebookIcon />;
  return <AppleIcon />;
}

export default function SocialAuthButtons({
  redirectTo = "/dashboard",
  onError,
}) {
  const [loadingProvider, setLoadingProvider] = useState("");

  async function handleOAuth(provider) {
    try {
      setLoadingProvider(provider);

      const authBaseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "https://www.tixswap.cl")
      ).replace(/\/+$/, "");
      const callbackUrl = `${authBaseUrl}/auth/callback?redirectTo=${encodeURIComponent(
        redirectTo
      )}`;

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setLoadingProvider("");
      onError?.(
        error?.message ||
          "No se pudo iniciar el acceso social. Revisa la configuración del proveedor."
      );
    }
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.map((provider) => {
        const isLoading = loadingProvider === provider.id;

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleOAuth(provider.id)}
            disabled={Boolean(loadingProvider)}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={
                provider.id === "apple" ? "text-slate-900" : ""
              }
            >
              <ProviderIcon providerId={provider.id} />
            </span>
            <span>{isLoading ? "Redirigiendo..." : provider.label}</span>
          </button>
        );
      })}
    </div>
  );
}
