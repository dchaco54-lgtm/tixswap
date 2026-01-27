"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BrowserQRCodeReader } from "@zxing/browser";

const DRAFT_KEY = "tixswap_sell_draft_v1";

export default function SellFilePage() {
  const router = useRouter();

  const [draft, setDraft] = useState(null);

  const [isNominada, setIsNominada] = useState(false);
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const [viewUrl, setViewUrl] = useState(null);
  const [sha256, setSha256] = useState(null);
  const [qrPayload, setQrPayload] = useState("");
  const [summary, setSummary] = useState(null);

  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setDraft(parsed);

      if (parsed?.ticketUpload?.isNominada) setIsNominada(true);
      if (parsed?.ticketUpload?.uploaded) {
        setUploaded(true);
        setViewUrl(parsed?.ticketUpload?.viewUrl || null);
        setSha256(parsed?.ticketUpload?.sha256 || null);
        setSummary(parsed?.ticketUpload?.summary || null);
      }
    } catch {
      // noop
    }
  }, []);

  const canValidate = useMemo(() => !!file && !uploading && !uploaded, [file, uploading, uploaded]);
  const canContinue = useMemo(() => uploaded && !uploading, [uploaded, uploading]);

  async function decodeQrFromPdf(pdfFile) {
    console.log('[QR Debug] Iniciando lectura de QR del PDF...');
    try {
      // Cargar pdf.js desde CDN y usar el objeto global pdfjsLib
      console.log('[QR Debug] Cargando pdf.js desde CDN...');
      const pdfjsLib = window.pdfjsLib || (await (async () => {
        const existing = document.querySelector('script[data-pdfjs-lib]');
        if (!existing) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.async = true;
          script.setAttribute('data-pdfjs-lib', '1');
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar pdf.js desde CDN'));
          });
        }
        return window.pdfjsLib;
      })());

      if (!pdfjsLib || !pdfjsLib.getDocument) {
        console.warn('[QR Debug] ⚠️ pdfjsLib no disponible o getDocument ausente');
        return null;
      }
      console.log('[QR Debug] ✅ pdf.js cargado correctamente');

      // Configurar worker (necesario para render)
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } catch (e) {
        // noop
      }

      const buf = await pdfFile.arrayBuffer();
      console.log('[QR Debug] PDF leído, tamaño buffer:', buf.byteLength);
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      console.log('[QR Debug] PDF parseado, páginas:', pdf.numPages);

      // Intentar las primeras 3 páginas por si el QR no está en la primera
      const pagesToTry = Math.min(pdf.numPages || 1, 3);
      const reader = new BrowserQRCodeReader();

      for (let i = 1; i <= pagesToTry; i += 1) {
        try {
          console.log(`[QR Debug] Escaneando página ${i}/${pagesToTry}...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 3 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          console.log(`[QR Debug] Renderizando página ${i} (${canvas.width}x${canvas.height})...`);
          await page.render({ canvasContext: ctx, viewport }).promise;

          const result = await reader.decodeFromCanvas(canvas).catch((decodeErr) => {
            console.log(`[QR Debug] No se pudo decodificar QR en página ${i}:`, decodeErr?.message);
            return null;
          });
          const text = result?.getText?.() || result?.text || null;
          console.log(`[QR Debug] Resultado página ${i}:`, text ? `QR encontrado (${text.length} chars)` : 'No QR');
          if (text && text.length > 6) {
            console.log('[QR Debug] ✅ QR válido encontrado:', text.substring(0, 50) + '...');
            return text;
          }
        } catch (perPageErr) {
          console.warn('[QR Debug] ⚠️ Error en página', i, ':', perPageErr?.message);
        }
      }

      console.log('[QR Debug] ⚠️ No se encontró QR en ninguna de las', pagesToTry, 'páginas');
      return null;
    } catch (err) {
      console.error('[QR Debug] ❌ Error fatal en decodeQrFromPdf:', err);
      return null;
    }
  }

  async function handleValidateAndUpload() {
    setError("");
    setViewUrl(null);
    setSha256(null);
    setSummary(null);

    if (!file) return setError("Selecciona un PDF primero.");
    if (file.type !== "application/pdf") return setError("El archivo debe ser PDF.");
    if (file.size > 8 * 1024 * 1024) return setError("Máx 8MB.");

    setUploading(true);

    try {
      // Intentar leer el QR del PDF antes de enviar
      console.log('[Upload] Intentando leer QR del archivo:', file.name);
      const qr = await decodeQrFromPdf(file);
      
      // TEMPORAL: permitir continuar sin QR para debuggear
      if (!qr || qr.length < 6) {
        console.warn('[Upload] ⚠️ No se detectó QR válido, continuando de todas formas (modo debug)');
        // En lugar de bloquear, mostramos warning pero continuamos
      } else {
        console.log('[Upload] ✅ QR detectado correctamente');
      }
      setQrPayload(qr || '');


      // Obtener access_token de la sesión actual
      let accessToken = null;
      try {
        const { data } = await supabase.auth.getSession();
        accessToken = data?.session?.access_token ?? null;
      } catch {}

      // sacar user id si existe sesión (opcional, el backend lo puede derivar)
      let sellerId = null;
      try {
        const { data } = await supabase.auth.getUser();
        sellerId = data?.user?.id ?? null;
      } catch {}

      const fd = new FormData();
      fd.append("file", file);
      fd.append("isNominada", String(isNominada));
      fd.append("qr_payload", qr || ''); // Enviar string vacío si no hay QR
      if (sellerId) fd.append("sellerId", sellerId);

      console.log('[Upload] Enviando al backend:', { 
        fileName: file.name, 
        fileSize: file.size, 
        hasQR: !!(qr && qr.length > 0),
        qrLength: qr?.length || 0 
      });

      const res = await fetch("/api/tickets/register", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const data = await res.json().catch(() => ({}));

      console.log('[Upload] Respuesta del servidor:', { status: res.status, ok: res.ok, data });

      if (!res.ok) {
        // duplicado
        if (res.status === 409 || data?.error === "DUPLICATE") {
          setError(data?.message || "Este ticket ya fue subido antes.");
          if (data?.existing?.viewUrl) setViewUrl(data.existing.viewUrl);
          if (data?.sha256) setSha256(data.sha256);
          return;
        }

        setError(
          data?.details
            ? `${data.error}: ${data.details}`
            : (data?.error || "Error registrando ticket (/api/tickets/register).")
        );
        return;
      }

      setUploaded(true);
      setViewUrl(data?.viewUrl || null);
      setSha256(data?.sha256 || null);
      setSummary(data?.summary || null);

      const nextDraft = {
        ...(draft || {}),
        ticketUpload: {
          uploaded: true,
          isNominada,
          ticketUploadId: data?.ticketUploadId || null,
          sha256: data?.sha256 || null,
          filePath: data?.filePath || null,
          viewUrl: data?.viewUrl || null,
          createdAt: data?.createdAt || null,
          summary: data?.summary || null,
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
    if (!uploaded) return;
    router.push("/sell/confirm");
  }

  function handleBack() {
    router.push("/sell");
  }

  function handleReplace() {
    setUploaded(false);
    setViewUrl(null);
    setSha256(null);
    setSummary(null);
    setFile(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
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

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={isNominada}
                  onChange={(e) => setIsNominada(e.target.checked)}
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
                    setSummary(null);
                    setFile(e.target.files?.[0] || null);
                  }}
                  disabled={uploading || uploaded}
                />
                <div className="mt-2 text-xs text-slate-500">Máx 8MB. Validamos PDF real + anti-duplicado.</div>

                {uploaded ? (
                  <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    Ticket ya cargado ✅
                  </div>
                ) : null}

                {summary ? (
                  <div className="mt-3 text-sm text-slate-700">
                    <div className="font-semibold">{summary.event_name || "Evento"}</div>
                    <div className="text-xs text-slate-500">{summary.venue || "Recinto"} · {summary.sector || "Sector"}</div>
                  </div>
                ) : null}

                {viewUrl ? (
                  <div className="mt-3 text-sm">
                    <a className="text-blue-600 hover:underline" href={viewUrl} target="_blank" rel="noreferrer">
                      Ver PDF (link temporal)
                    </a>
                    {sha256 ? <div className="mt-1 text-xs text-slate-500">Hash: {sha256.slice(0, 12)}…</div> : null}
                  </div>
                ) : null}

                {uploaded ? (
                  <div className="mt-3">
                    <button type="button" className="tix-btn-secondary" onClick={handleReplace}>
                      Reemplazar PDF
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button type="button" className="tix-btn-secondary" onClick={handleBack} disabled={uploading}>
                Volver
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={uploaded ? "tix-btn-secondary" : "tix-btn-primary"}
                  onClick={handleValidateAndUpload}
                  disabled={!canValidate}
                >
                  {uploading ? "Validando..." : uploaded ? "Validado ✓" : "Validar y subir"}
                </button>

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

            <div className="mt-3 text-sm text-slate-500">
              Para continuar, primero debes validar y subir el PDF.
            </div>

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
