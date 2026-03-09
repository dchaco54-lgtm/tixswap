"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildEventPostImageUrl,
  buildEventShareText,
  buildEventShareUrl,
  buildEventStoryImageUrl,
  buildTicketPostImageUrl,
  buildTicketShareText,
  buildTicketShareUrl,
  buildTicketStoryImageUrl,
  formatCLP,
  formatEventDateLabel,
} from "@/lib/share";

const TOAST_TTL = 2200;

function ActionIcon({ children, className = "" }) {
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${className}`.trim()}
    >
      {children}
    </span>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8 12a4 4 0 0 1 0-.2m8.3-4.6a3 3 0 1 0-2.6-5.4 3 3 0 0 0 2.6 5.4Zm0 15a3 3 0 1 0-2.6-5.4 3 3 0 0 0 2.6 5.4ZM7.7 13.7a3 3 0 1 0-2.4-5.5 3 3 0 0 0 2.4 5.5Zm7.1 4-4.7-2.8m4.7-8.7-4.7 2.8" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M20.5 11.8a8.3 8.3 0 0 1-12 7.4L4 20.7l1.6-4.3A8.3 8.3 0 1 1 20.5 11.8Zm-8.2-6.6a6.6 6.6 0 0 0-5.7 9.8l.2.3-.9 2.5 2.6-.8.3.2a6.6 6.6 0 1 0 3.5-12Zm3.9 8.4c-.2-.1-1.3-.7-1.5-.7-.2-.1-.3-.1-.4.1-.1.2-.5.7-.6.8-.1.1-.2.1-.4 0a5.3 5.3 0 0 1-2.6-2.3c-.2-.3.2-.4.6-1 .1-.1.1-.2 0-.4l-.7-1.6c-.1-.2-.3-.2-.4-.2h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.3 1 2.4c.1.1 1.7 2.6 4.1 3.6 1.5.6 2 .6 2.7.5.4-.1 1.3-.5 1.4-1.1.2-.6.2-1 .1-1.1-.1-.1-.2-.1-.4-.2Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.5c0-.8.2-1.4 1.4-1.4h1.5V5.6c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8V14h2.5v7h3Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function NativeShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function LargeAction({
  icon,
  title,
  subtitle,
  onClick,
  children = null,
  className = "",
}) {
  return (
    <div className={`rounded-[26px] border border-slate-200 bg-white/90 p-4 shadow-sm ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 text-left"
      >
        <ActionIcon className="bg-slate-100 text-slate-700">{icon}</ActionIcon>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
        </div>
      </button>
      {children}
    </div>
  );
}

export default function ShareModal({
  open,
  onClose,
  type,
  eventId,
  eventName,
  eventDate,
  venue,
  city,
  ticketId = null,
  ticketPrice = null,
  sector = null,
  row_label = null,
  seat_label = null,
}) {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const link = useMemo(() => {
    if (type === "ticket") {
      return buildTicketShareUrl(eventId, ticketId);
    }
    return buildEventShareUrl(eventId);
  }, [eventId, ticketId, type]);

  const shareText = useMemo(() => {
    if (type === "ticket") {
      return buildTicketShareText({
        eventName,
        ticketPrice,
        link,
      });
    }

    return buildEventShareText({
      eventName,
      link,
    });
  }, [eventName, link, ticketPrice, type]);

  const storyUrl = useMemo(() => {
    if (type === "ticket") return buildTicketStoryImageUrl(ticketId);
    return buildEventStoryImageUrl(eventId);
  }, [eventId, ticketId, type]);

  const postUrl = useMemo(() => {
    if (type === "ticket") return buildTicketPostImageUrl(ticketId);
    return buildEventPostImageUrl(eventId);
  }, [eventId, ticketId, type]);

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const dateLabel = formatEventDateLabel(eventDate);
  const locationLabel = [venue, city].filter(Boolean).join(", ");
  const seatLabel = [sector && `Sector ${sector}`, row_label && `Fila ${row_label}`, seat_label && `Asiento ${seat_label}`]
    .filter(Boolean)
    .join(" · ");
  const priceLabel = formatCLP(ticketPrice);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (kind, message) => {
    setToast({ kind, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_TTL);
  };

  const copyToClipboard = async (value, successMessage, errorMessage) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showToast("ok", successMessage);
      return true;
    } catch (error) {
      console.error("[ShareModal] copy error:", error);
      showToast("err", errorMessage);
      return false;
    }
  };

  const openExternal = (url) => {
    try {
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = url;
      return true;
    } catch (error) {
      console.error("[ShareModal] external open error:", error);
      return false;
    }
  };

  const onWhatsApp = () => {
    const ok = openExternal(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
    if (!ok) {
      showToast("err", "No pudimos abrir WhatsApp. Copia el texto y compártelo manualmente.");
    }
  };

  const onFacebook = () => {
    const ok = openExternal(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`
    );
    if (!ok) {
      showToast("err", "No pudimos abrir Facebook. Copia el link e inténtalo otra vez.");
    }
  };

  const onNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: eventName || "TixSwap",
        text: shareText,
        url: link,
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("[ShareModal] native share error:", error);
      showToast("err", "No se pudo compartir desde el teléfono.");
    }
  };

  const onDownload = (downloadUrl, label) => {
    let nextUrl = downloadUrl;
    try {
      const url = new URL(downloadUrl);
      url.searchParams.set("v", String(Date.now()));
      nextUrl = url.toString();
    } catch (error) {
      console.error("[ShareModal] versioned download url error:", error);
    }

    const ok = openExternal(nextUrl);
    if (!ok) {
      showToast("err", `No pudimos abrir ${label.toLowerCase()}.`);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/20 bg-[linear-gradient(180deg,_#eff6ff_0%,_#ffffff_22%,_#f8fbff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.18),_transparent_56%)]" />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                <ShareIcon />
                Compartir
              </div>
              <h3 className="mt-4 text-2xl font-bold text-slate-900">Compartir</h3>
              <p className="mt-1 text-sm text-slate-500">Elige dónde publicarlo</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
              aria-label="Cerrar modal de compartir"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">{eventName || "Evento"}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
              {dateLabel ? <span>{dateLabel}</span> : null}
              {locationLabel ? <span>{locationLabel}</span> : null}
              {priceLabel && type === "ticket" ? <span>{priceLabel}</span> : null}
              {seatLabel && type === "ticket" ? <span>{seatLabel}</span> : null}
            </div>
          </div>

          {canNativeShare ? (
            <button
              type="button"
              onClick={onNativeShare}
              className="mt-4 tix-btn-primary w-full gap-2 rounded-2xl py-3.5"
            >
              <NativeShareIcon />
              Compartir…
            </button>
          ) : null}

          <div className="mt-4 grid gap-3">
            <LargeAction
              icon={<InstagramIcon />}
              title="Instagram"
              subtitle="Descarga una imagen lista para Story o Post, y copia el link para el sticker."
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onDownload(storyUrl, "Story")}
                  className="tix-btn-secondary w-full justify-center gap-2 rounded-2xl px-4 py-3"
                >
                  <DownloadIcon />
                  Descargar Story
                </button>
                <button
                  type="button"
                  onClick={() => onDownload(postUrl, "Post")}
                  className="tix-btn-secondary w-full justify-center gap-2 rounded-2xl px-4 py-3"
                >
                  <DownloadIcon />
                  Descargar Post
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    link,
                    "Link copiado ✅",
                    "No pudimos copiar el link. Intenta de nuevo."
                  )
                }
                className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
              >
                <CopyIcon />
                Copiar link para sticker
              </button>
            </LargeAction>

            <LargeAction
              icon={<WhatsAppIcon />}
              title="WhatsApp"
              subtitle="Abre WhatsApp con el texto listo y preview del link."
              onClick={onWhatsApp}
            />

            <LargeAction
              icon={<FacebookIcon />}
              title="Facebook"
              subtitle="Comparte directo en Facebook usando el link público del evento o entrada."
              onClick={onFacebook}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                copyToClipboard(link, "Link copiado ✅", "No pudimos copiar el link. Intenta de nuevo.")
              }
              className="tix-btn-secondary w-full gap-2 rounded-2xl px-4 py-3"
            >
              <CopyIcon />
              Copiar link
            </button>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  shareText,
                  "Texto copiado ✅",
                  "No pudimos copiar el texto. Intenta de nuevo."
                )
              }
              className="tix-btn-secondary w-full gap-2 rounded-2xl px-4 py-3"
            >
              <CopyIcon />
              Copiar texto
            </button>
          </div>

          {toast ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                toast.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {toast.message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
