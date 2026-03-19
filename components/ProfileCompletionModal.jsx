"use client";

import { useEffect, useState } from "react";

import {
  PROFILE_COMPLETION_COPY,
  validateProfileCompletionData,
} from "@/lib/profileCompletion";

function getInitialForm(profile, user) {
  return {
    full_name:
      String(
        profile?.full_name ||
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          ""
      ).trim(),
    rut: String(profile?.rut || user?.user_metadata?.rut || "").trim(),
    phone: String(profile?.phone || user?.user_metadata?.phone || "").trim(),
  };
}

export default function ProfileCompletionModal({
  actionLabel = "continuar",
  allowClose = false,
  onClose,
  onCompleted,
  profile,
  user,
}) {
  const [form, setForm] = useState(() => getInitialForm(profile, user));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setForm(getInitialForm(profile, user));
    setErrors({});
    setSubmitError("");
  }, [profile, user]);

  useEffect(() => {
    if (!allowClose) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [allowClose, onClose]);

  const title = actionLabel
    ? `Antes de ${actionLabel}`
    : PROFILE_COMPLETION_COPY.title;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");

    const validation = validateProfileCompletionData(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrors({});

      const response = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.normalized),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (json?.errors) {
          setErrors(json.errors);
          return;
        }

        throw new Error(json?.error || "No se pudieron guardar tus datos.");
      }

      onCompleted?.(json.profile || null);
    } catch (error) {
      setSubmitError(error?.message || "No se pudieron guardar tus datos.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));

      if (errors[field]) {
        setErrors((current) => {
          const next = { ...current };
          delete next[field];
          return next;
        });
      }
    };
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_45%),linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#eef4ff_100%)] px-6 py-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700">
                Seguridad de cuenta
              </div>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {PROFILE_COMPLETION_COPY.message}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {PROFILE_COMPLETION_COPY.helper}
              </p>
            </div>

            {allowClose ? (
              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                Cerrar
              </button>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 sm:px-8">
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Nombre completo
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={updateField("full_name")}
                placeholder="Ej: Juan Pérez Soto"
                className="tix-input"
                autoComplete="name"
                disabled={submitting}
              />
              {errors.full_name ? (
                <p className="mt-1 text-xs text-rose-600">{errors.full_name}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  RUT
                </label>
                <input
                  type="text"
                  value={form.rut}
                  onChange={updateField("rut")}
                  placeholder="12.345.678-9"
                  className="tix-input"
                  autoComplete="off"
                  disabled={submitting}
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
                  value={form.phone}
                  onChange={updateField("phone")}
                  placeholder="+56 9 1234 5678"
                  className="tix-input"
                  autoComplete="tel"
                  disabled={submitting}
                />
                {errors.phone ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    Usaremos este número solo para seguridad y contacto de la cuenta.
                  </p>
                )}
              </div>
            </div>
          </div>

          {submitError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-5 text-slate-500">
              Tus datos quedan asociados a tu cuenta para proteger transacciones y soporte.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Guardando..." : PROFILE_COMPLETION_COPY.cta}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
