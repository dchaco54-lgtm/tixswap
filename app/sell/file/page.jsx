"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const DRAFT_KEY = "tixswap_sell_draft_v1";

export default function SellFilePage() {
  const router = useRouter();

  const [draft, setDraft] = useState(null);

  const [isNominated, setIsNominated] = useState(false);
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const [viewUrl, setViewUrl] = useState(null);
  const [sha256, setSha256] = useState(null);

  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setDraft(parsed);

      if (parsed?.ticketUpload?.isNominated) setIsNominated(true);
      if (parsed?.ticketUpload?.uploaded) {
        setUploaded(true);
        setViewUrl(parsed?.ticketUpload?.viewUrl || null);
        setSha256(parsed?.ticketUpload?.sha256 || null);
      }
    } catch {
      // noop
    }
  }, []);

  const canValidate = useMemo(() => {
    return !!file && !uploading && !uploaded;
  }, [file, uploading, uploaded]);

  const canContinue = useMemo(() => {
    return uploaded && !uploading;
  }, [uploaded, uploading]);

  async function handleValidateAndUpload() {
    setError("");
    setViewUrl(null);
    setSha256(null);

    if (!file) {
      setError("Selecciona un PDF primero.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("El archivo debe ser PDF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Máx 8MB.");
      return;
    }

    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("isNominated", String(isNominated));

      // Si tienes userId en tu draft, pásalo. Si no, queda "anon".
      if (draft?.userId) fd.append("userId", draft.userId);

      const res = await fetch("/api/tickets/register", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Duplicado: mostramos mensaje y si viene viewUrl lo dejamos linkeado
        if (data?.error === "DUPLICATE") {
          setUploaded(false); // aún no lo dejamos “validado” para avanzar si tú quieres
          // pero UX: si ya existe, igual te dejo el link para verlo y el mensaje.
          setError(data?.message || "Entrada ya subida en Tixswap");
          if (data?.existing?.viewUrl) setViewUrl(data.existing.viewUrl);
          if (data?.sha256) setSha256(data.sha256);
          return;
        }

        setError(data?.details ? `${data.error}: ${data.details}` : (data?.error || "Error registrando ticket (/api/tickets/register)."));
        return;
      }

      // OK
      setUploaded(true);
      setViewUrl(data?.viewUrl || null);
      setSha256(data?.sha256 || null);

      const nextDraft = {
        ...(draft || {}),
        ticketUpload: {
          uploaded: true,
          isNominated,
          sha256: data?.sha256 || null,
          filePath: data?.filePath || null,
          viewUrl: data?.viewUrl || null,
          createdAt: data?.createdAt || null,
        },
      };

      localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
      setDraft(nextDraft);
    } catch (e) {
      setError(e?.message || "Error registrando ticket (/api/tickets/register).");
    } finally {
      setUploading(false);
    }
  }

  function handleContinue() {
    // Bloqueado sí o sí
    if (!uploaded) return;

    // Paso 3 (ajusta si tu ruta es distinta)
    router.push("/sell/confirm");
  }

  function handleBack() {
    router.push("/sell");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Tarjeta principal (misma onda visual) */}
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          {/* Stepper (simple, sin romper tu estructura) */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-semibold">
                  1
                </div>
                <div className="font-semibold">Detalles</div>
              </div>
              <div className="h-[2px] flex-1 bg-white/30" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-semibold text-slate-900">
                  2
                </div>
                <div className="font-semibold">Archivo</div>
              </div>
              <div className="h-[2px] flex-1 bg-white/30" />
              <div className="flex items-center gap-3 opacity-70">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-semibold">
                  3
                </div>
                <div className="font-semibold">Confirmar</div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-bold text-slate-900">Archivo</h1>
            <p className="mt-2 text-slate-600">
              Sube el PDF del ticket. Validaremos formato y evitaremos duplicados.
            </p>

            {/* Nominada */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={isNominated}
                  onChange={(e) => setIsNominated(e.target.checked)}
                  disabled={uploading}
                />
                <div>
                  <div className="font-semibold text-slate-900">Es nominada</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Si es nominada, al momento de la compra se abrirá un chat comprador↔vendedor para coordinar la nominación
                    y subir el PDF re-nominado.
                  </div>
                </div>
              </label>
            </div>

            {/* Upload */}
            <div className="mt-8">
              <div className="text-sm font-medium text-slate-700">Subir PDF del ticket</div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    setError("");
                    setUploaded(false);
                    setViewUrl(null);
                    setSha256(null);
                    setFile(e.target.files?.[0] || null);
                  }}
                  disabled={uploading}
                />

                <div className="mt-2 text-xs text-slate-500">Máx 8MB. Validamos PDF real + anti-duplicado.</div>

                {viewUrl ? (
                  <div className="mt-3 text-sm">
                    <a className="text-blue-600 hover:underline" href={viewUrl} target="_blank" rel="noreferrer">
                      Ver PDF (link temporal)
                    </a>
                    {sha256 ? <div className="mt-1 text-xs text-slate-500">Hash: {sha256.slice(0, 12)}…</div> : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Botones */}
            <div className="mt-8 flex items-center justify-between">
              <button type="button" className="tix-btn-secondary" onClick={handleBack} disabled={uploading}>
                Volver
              </button>

              <div className="flex items-center gap-3">
                {/* Validar: azul cuando corresponde, gris cuando ya está validado */}
                <button
                  type="button"
                  className={uploaded ? "tix-btn-secondary" : "tix-btn-primary"}
                  onClick={handleValidateAndUpload}
                  disabled={!canValidate}
                  title={!file ? "Selecciona un PDF" : uploaded ? "Ya validado" : ""}
                >
                  {uploading ? "Validando..." : uploaded ? "Validado ✓" : "Validar y subir"}
                </button>

                {/* Continuar: bloqueado hasta upload OK; cuando OK -> azul */}
                <button
                  type="button"
                  className={canContinue ? "tix-btn-primary" : "tix-btn-secondary"}
                  onClick={handleContinue}
                  disabled={!canContinue}
                  title={!canContinue ? "Para continuar, primero debes validar y subir el PDF." : ""}
                >
                  Continuar
                </button>
              </div>
            </div>

            {/* Mensaje UX */}
            <div className="mt-3 text-sm text-slate-500">
              Para continuar, primero debes validar y subir el PDF.
            </div>

            {/* Error */}
            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
