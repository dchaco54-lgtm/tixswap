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
  const shareText = text ? `${text} ${safeUrl}`.trim() : safeUrl;

  const copyLink = async () => {
    if (!safeUrl) {
      showToast("err", "Link no disponible");
      return;
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
      showToast("ok", "Link copiado");
    } catch {
      showToast("err", "No se pudo copiar");
    }
  };

  const shareNative = async () => {
    if (!safeUrl) {
      showToast("err", "Link no disponible");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: safeUrl });
        showToast("ok", "Compartido");
      } catch (e) {
        if (e?.name !== "AbortError") {
          showToast("err", "No se pudo compartir");
        }
      }
      return;
    }

    await copyLink();
  };

  const openExternal = (shareUrl) => {
    if (!shareUrl) return;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const onWhatsApp = () => {
    openExternal(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  };

  const onFacebook = () => {
    openExternal(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeUrl)}`
    );
  };

  const onInstagram = async () => {
    if (navigator.share) {
      await shareNative();
      return;
    }
    await copyLink();
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
            onClick={async () => {
              await shareNative();
              setOpen(false);
            }}
          >
            Compartir...
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
            Instagram
          </MenuItem>
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
