"use client";

import { useEffect, useRef, useState } from "react";

export default function ShareButton({
  url,
  title = "",
  text = "",
  className = "",
  disabled = false,
  disabledReason = "No disponible",
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const rootRef = useRef(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const safeUrl = typeof url === "string" ? url : "";
  const shareTitle = title || text || "Entrada en TixSwap";

  const copyLink = async (opts = {}) => {
    const successMessage = opts.successMessage || "Link copiado";
    const errorMessage = opts.errorMessage || "No se pudo copiar";
    if (!safeUrl) {
      showToast("err", "Link no disponible");
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = safeUrl;
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
    } catch {
      showToast("err", errorMessage);
      return false;
    }
  };

  const openExternal = (shareUrl) => {
    if (!shareUrl) return;
    const win = window.open(shareUrl, "_blank", "noopener,noreferrer");
    return !!win;
  };

  const isMobile = () => {
    if (typeof navigator === "undefined") return false;
    if (navigator.userAgentData?.mobile) return true;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  };

  const openInstagram = () => {
    if (isMobile()) {
      window.location.href = "instagram://story-camera";
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          window.location.href = "https://www.instagram.com/";
        }
      }, 800);
      return;
    }

    openExternal("https://www.instagram.com/");
  };

  const onWhatsApp = () => {
    const shareText = `${shareTitle}\n${safeUrl}`.trim();
    const ok = openExternal(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`
    );
    if (!ok) {
      copyLink();
    }
  };

  const onFacebook = () => {
    const ok = openExternal(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        safeUrl
      )}`
    );
    if (!ok) {
      copyLink();
    }
  };

  const onInstagram = async () => {
    await copyLink({
      successMessage:
        "Link copiado ✅ Abre Instagram → Historia → Sticker Enlace → Pegar",
      errorMessage: "No se pudo copiar el link",
    });
    try {
      openInstagram();
    } catch {
      // no-op: no mostrar error solo por no poder abrir Instagram
    }
  };

  const onShareMore = async () => {
    if (!safeUrl || !navigator.share) return;
    try {
      await navigator.share({ title: shareTitle, text, url: safeUrl });
      showToast("ok", "Compartido");
    } catch (e) {
      if (e?.name !== "AbortError") {
        showToast("err", "No se pudo compartir");
      }
    }
  };

  const buttonClass = `px-3 py-2 rounded-xl text-sm border transition ${
    disabled
      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
      : "bg-white hover:bg-gray-50 text-gray-700"
  }`;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={buttonClass}
        title={disabled ? disabledReason : "Compartir"}
      >
        Compartir
      </button>

      {open && !disabled ? (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border bg-white shadow-lg z-20 overflow-hidden">
          <MenuItem
            onClick={async () => {
              await copyLink();
              setOpen(false);
            }}
          >
            Copiar link
          </MenuItem>
          <MenuItem
            onClick={() => {
              onWhatsApp();
              setOpen(false);
            }}
          >
            WhatsApp
          </MenuItem>
          <MenuItem
            onClick={() => {
              onFacebook();
              setOpen(false);
            }}
          >
            Facebook
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await onInstagram();
              setOpen(false);
            }}
          >
            Instagram (Historia)
          </MenuItem>
          {typeof navigator !== "undefined" && navigator.share ? (
            <MenuItem
              onClick={async () => {
                await onShareMore();
                setOpen(false);
              }}
            >
              Más apps...
            </MenuItem>
          ) : null}
        </div>
      ) : null}

      {toast ? (
        <div
          className={`absolute right-0 -top-10 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs shadow-md border ${
            toast.type === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}
