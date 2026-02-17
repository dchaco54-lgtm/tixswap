"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TOAST_TTL = 3000;

export default function EventAlertButton({ eventId, eventName = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState(null); // { type, msg }

  const isLoggedIn = !!user;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), TOAST_TTL);
  };

  const buildRedirectUrl = () => {
    const qs = searchParams?.toString();
    const current = `${pathname || "/events"}${qs ? `?${qs}` : ""}`;
    const redirect = encodeURIComponent(current);
    const subscribeEvent = encodeURIComponent(String(eventId || ""));
    return `/login?redirectTo=${redirect}&subscribeEvent=${subscribeEvent}`;
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!eventId) return;
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const nextUser = data?.user || null;
        if (!mounted) return;
        setUser(nextUser);

        if (!nextUser) {
          setSubscribed(false);
          return;
        }

        const { data: row, error } = await supabase
          .from("event_alert_subscriptions")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", nextUser.id)
          .maybeSingle();

        if (error) {
          console.warn("[EventAlert] load error:", error);
          setSubscribed(false);
          return;
        }

        setSubscribed(Boolean(row));
      } catch (err) {
        console.warn("[EventAlert] load error:", err);
        setSubscribed(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [eventId, supabase]);

  const handleClick = async () => {
    if (!eventId) return;

    if (!isLoggedIn) {
      router.push(buildRedirectUrl());
      return;
    }

    setWorking(true);
    try {
      if (subscribed) {
        const { error } = await supabase
          .from("event_alert_subscriptions")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);

        if (error) throw error;

        setSubscribed(false);
        showToast("ok", "Alerta desactivada.");
      } else {
        const { error } = await supabase
          .from("event_alert_subscriptions")
          .upsert(
            { user_id: user.id, event_id: eventId },
            { onConflict: "user_id,event_id" }
          );

        if (error) throw error;

        setSubscribed(true);
        showToast("ok", "Alerta activada. Te avisaremos por correo.");
      }
    } catch (err) {
      console.warn("[EventAlert] toggle error:", err);
      showToast(
        "err",
        subscribed
          ? "No pudimos desactivar la alerta. Intenta nuevamente."
          : "No pudimos activar la alerta. Intenta nuevamente."
      );
    } finally {
      setWorking(false);
    }
  };

  const label = loading
    ? "Cargando..."
    : !isLoggedIn
    ? "Inicia sesión para activar alerta"
    : subscribed
    ? "Alerta activada ✓"
    : "Alerta por nuevas entradas";

  const buttonClass = !isLoggedIn
    ? "tix-btn-secondary"
    : subscribed
    ? "tix-btn-secondary"
    : "tix-btn-primary";

  const ariaLabel = eventName
    ? `${label} para ${eventName}`
    : label;

  return (
    <div className="flex flex-col items-start md:items-end gap-1.5">
      <button
        type="button"
        className={`${buttonClass} w-full md:w-auto`}
        onClick={handleClick}
        disabled={loading || working}
        aria-label={ariaLabel}
        aria-pressed={subscribed}
        aria-busy={loading || working}
      >
        {label}
      </button>
      {isLoggedIn && (
        <div className="text-xs text-gray-500">
          Te avisamos por correo y notificaciones.
        </div>
      )}
      {toast && (
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
    </div>
  );
}
