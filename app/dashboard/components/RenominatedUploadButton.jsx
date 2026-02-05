"use client";

import { useState } from "react";
import supabase from "@/lib/supabaseClient";

export default function RenominatedUploadButton({ orderId, disabled, onUploaded }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (file) => {
    try {
      setErr("");
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setErr("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }

      const signedRes = await fetch(`/api/orders/${orderId}/renominated/signed-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileName: file.name }),
      });

      const signedJson = await signedRes.json().catch(() => ({}));
      if (!signedRes.ok || !signedJson?.signedUrl || !signedJson?.path) {
        setErr(
          signedJson?.message ||
            signedJson?.error ||
            "No se pudo generar la URL segura de subida."
        );
        return;
      }

      const uploadRes = await fetch(signedJson.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      if (!uploadRes.ok) {
        setErr("No se pudo subir el archivo al storage.");
        return;
      }

      const confirmRes = await fetch(`/api/orders/${orderId}/renominated`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bucket: signedJson.bucket,
          path: signedJson.path,
        }),
      });

      const confirmJson = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        setErr(
          confirmJson?.message ||
            confirmJson?.error ||
            "No se pudo confirmar el archivo renominado."
        );
        return;
      }

      onUploaded?.(confirmJson);
    } catch (e) {
      setErr(e?.message || "Error subiendo archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="inline-flex items-center gap-2">
        <input
          type="file"
          accept="application/pdf"
          disabled={disabled || loading}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          id={`renom-${orderId}`}
        />
        <span
          onClick={() => {
            if (disabled || loading) return;
            document.getElementById(`renom-${orderId}`)?.click();
          }}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold ${
            disabled || loading
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "Subiendo..." : "Subir PDF renominado"}
        </span>
      </label>

      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      <p className="text-xs text-slate-500">
        Solo PDF. Esto habilita la descarga para el comprador.
      </p>
    </div>
  );
}
