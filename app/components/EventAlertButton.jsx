"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TOAST_TTL = 3000;
const ALERT_INTENT_PARAM = "subscribeToAlerts";

function normalizeChannels(payload) {
  return {
    email: payload?.channels?.email !== false,
    inApp: payload?.channels?.inApp !== false,
  };
}

export default function EventAlertButton({
  eventId,
  eventName = null,
  compact = false,
  hideHelper = false,
  allowUnsubscribe = true,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toastTimerRef = useRef(null);
  const autoSubscriptionRef = useRef(false);

  const [authState, setAuthState] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [channels, setChannels] = useState({ email: true, inApp: true });
  const [working, setWorking] = useState(false);
  const [helperMessage, setHelperMessage] = useState("");
  const [toast, setToast] = useState(null);

  const isLoggedIn = authState === "authenticated";
  const hasPendingIntent = searchParams?.get(ALERT_INTENT_PARAM) === "1";

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_TTL);
  }, []);

  const buildCurrentUrl = useCallback((withIntent = false) => {
    const params = new URLSearchParams(searchParams?.toString() || "");

    if (withIntent) {
      params.set(ALERT_INTENT_PARAM, "1");
    } else {
      params.delete(ALERT_INTENT_PARAM);
    }

    const nextPath = pathname || (eventId ? `/events/${eventId}` : "/events");
    const query = params.toString();
    return `${nextPath}${query ? `?${query}` : ""}`;
  }, [eventId, pathname, searchParams]);

  const buildLoginRedirectUrl = useCallback((withIntent = false) => {
    return `/login?redirectTo=${encodeURIComponent(buildCurrentUrl(withIntent))}`;
  }, [buildCurrentUrl]);

  const clearPendingIntent = useCallback(() => {
    if (!hasPendingIntent) return;
    router.replace(buildCurrentUrl(false), { scroll: false });
  }, [buildCurrentUrl, hasPendingIntent, router]);

  const syncStatus = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      setAuthState("anonymous");
      setSubscribed(false);
      return;
    }

    setLoading(true);
    setHelperMessage("");

    try {
      const res = await fetch(`/api/events/${eventId}/alerts`, {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setAuthState("anonymous");
        setSubscribed(false);
        setChannels({ email: true, inApp: true });
        return;
      }

      if (!res.ok) {
        throw new Error(json?.error || "No pudimos cargar el estado de la alerta.");
      }

      setAuthState("authenticated");
      setSubscribed(Boolean(json?.subscribed));
      setChannels(normalizeChannels(json));
    } catch (err) {
      console.warn("[EventAlert] status error:", err);
      setAuthState("unknown");
      setSubscribed(false);
      setChannels({ email: true, inApp: true });
      setHelperMessage(err?.message || "No pudimos cargar el estado de la alerta.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const updateSubscription = useCallback(async ({
    method,
    successMessage,
    errorMessage,
    redirectWithIntent = false,
    clearIntentOnFinish = false,
  }) => {
    if (!eventId) return;

    setWorking(true);
    setHelperMessage("");

    try {
      const res = await fetch(`/api/events/${eventId}/alerts`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setAuthState("anonymous");
        router.push(buildLoginRedirectUrl(redirectWithIntent));
        return;
      }

      if (!res.ok) {
        throw new Error(json?.error || errorMessage);
      }

      setAuthState("authenticated");
      setSubscribed(Boolean(json?.subscribed));
      setChannels(normalizeChannels(json));
      showToast("ok", successMessage);

      if (clearIntentOnFinish) {
        clearPendingIntent();
      }
    } catch (err) {
      console.warn("[EventAlert] update error:", err);
      const message = err?.message || errorMessage;
      setHelperMessage(message);
      showToast("err", message);

      if (clearIntentOnFinish) {
        clearPendingIntent();
      }
    } finally {
      setWorking(false);
    }
  }, [buildLoginRedirectUrl, clearPendingIntent, eventId, router, showToast]);

  useEffect(() => {
    syncStatus();
  }, [syncStatus]);

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    autoSubscriptionRef.current = false;
  }, [eventId, hasPendingIntent]);

  useEffect(() => {
    if (!hasPendingIntent || loading || working) return;
    if (authState !== "authenticated") return;
    if (autoSubscriptionRef.current) return;

    autoSubscriptionRef.current = true;

    if (subscribed) {
      showToast("ok", "La alerta ya estaba activada para este evento.");
      clearPendingIntent();
      return;
    }

    void updateSubscription({
      method: "POST",
      successMessage: "Alerta activada. Te avisaremos por correo y dentro de TixSwap.",
      errorMessage: "No pudimos activar la alerta automáticamente.",
      redirectWithIntent: true,
      clearIntentOnFinish: true,
    });
  }, [
    authState,
    clearPendingIntent,
    eventId,
    hasPendingIntent,
    loading,
    showToast,
    subscribed,
    updateSubscription,
    working,
  ]);

  const handleClick = async () => {
    if (!eventId) return;

    if (!isLoggedIn && authState !== "unknown") {
      router.push(buildLoginRedirectUrl(true));
      return;
    }

    if (subscribed) {
      if (!allowUnsubscribe) return;

      await updateSubscription({
        method: "DELETE",
        successMessage: "Dejaste de recibir alertas para este evento.",
        errorMessage: "No pudimos desactivar la alerta. Intenta nuevamente.",
      });
      return;
    }

    await updateSubscription({
      method: "POST",
      successMessage: "Alerta activada. Te avisaremos por correo y dentro de TixSwap.",
      errorMessage: "No pudimos activar la alerta. Intenta nuevamente.",
      redirectWithIntent: true,
    });
  };

  const label = compact
    ? loading
      ? "Cargando..."
      : working
      ? "Guardando..."
      : subscribed
      ? "Alerta activada"
      : "Activar alerta"
    : loading
    ? "Cargando..."
    : working
    ? subscribed
      ? "Desactivando..."
      : "Activando..."
    : subscribed
    ? "Dejar de recibir alertas"
    : "Alerta por nuevas entradas";

  const buttonClass = compact
    ? subscribed && !allowUnsubscribe
      ? "inline-flex items-center text-sm font-medium text-slate-500 cursor-default"
      : "inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline underline-offset-4 disabled:opacity-60 disabled:cursor-not-allowed"
    : !isLoggedIn
    ? "tix-btn-secondary"
    : subscribed
    ? "tix-btn-secondary"
    : "tix-btn-primary";

  const ariaLabel = eventName ? `${label} para ${eventName}` : label;

  const channelSummary = [
    channels.email ? "correo" : null,
    channels.inApp ? "notificaciones dentro de TixSwap" : null,
  ]
    .filter(Boolean)
    .join(" y ");

  const defaultHelperMessage = helperMessage
    ? helperMessage
    : isLoggedIn && subscribed
    ? `Recibirás alertas por ${channelSummary || "correo y notificaciones dentro de TixSwap"}.`
    : isLoggedIn
    ? "Te avisamos por correo y dentro de TixSwap."
    : "Inicia sesión para suscribirte por correo y dentro de TixSwap.";

  const showHelper = !hideHelper && defaultHelperMessage;
  const shouldShowToast = !compact && toast;
  const isDisabled = loading || working || (compact && subscribed && !allowUnsubscribe);

  return (
    <div className={compact ? "flex flex-col items-start gap-1" : "flex flex-col items-start gap-1.5 md:items-end"}>
      <button
        type="button"
        className={`${buttonClass}${compact ? "" : " w-full md:w-auto"}`}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-pressed={subscribed}
        aria-busy={loading || working}
      >
        {label}
      </button>
      {showHelper ? <div className="text-xs text-gray-500">{defaultHelperMessage}</div> : null}
      {shouldShowToast && (
        <div
          className={
            toast.type === "err"
              ? "text-xs text-red-600"
              : "text-xs text-emerald-600"
          }
        >
          {toast.msg}
        </div>
      )}
      {compact && helperMessage ? (
        <div className="text-xs text-red-600">{helperMessage}</div>
      ) : null}
    </div>
  );
}
