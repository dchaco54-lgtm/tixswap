"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const DRAFT_KEY = "tixswap_sell_draft_v1";

async function sha256Hex(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function basicPdfCheck(file) {
  if (!file) return { ok: false, error: "No hay archivo." };
  if (file.type !== "application/pdf") return { ok: false, error: "Debe ser un PDF." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "PDF muy pesado (máx 8MB)." };

  // check header %PDF
  const slice = await file.slice(0, 5).arrayBuffer();
  const head = new TextDecoder().decode(slice);
  if (head !== "%PDF-") return { ok: false, error: "Archivo inválido: no parece PDF real." };

  // (heurística) PDFs cifrados suelen contener /Encrypt
  const firstChunk = await file.slice(0, 200000).text().catch(() => "");
  if (firstChunk.includes("/Encrypt")) {
    return { ok: false, error: "PDF protegido/ cifrado. Sube el ticket sin clave." };
  }

  return { ok: true };
}

export default function SellFilePage() {
  const router = useRouter();

  const steps = ["Detalles", "Archivo", "Confirmar"];
  const currentStep = 1;

  const [draft, setDraft] = useState(null);
  const [file, setFile] = useState(null);
  const [isNominated, setIsNominated] = useState(false);

  const [status, setStatus] = useState("idle"); // idle|checking|uploading|done|error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      router.replace("/sell");
      return;
    }
    try {
      const d = JSON.parse(raw);
      setDraft(d);
    } catch {
      router.replace("/sell");
    }
  }, [router]);

  const canContinue = useMemo(() => {
    return !!draft?.event_id && !!file && status === "done";
  }, [draft, file, status]);

  async function handleValidateAndUpload() {
    setMessage("");
    setStatus("checking");

    const check = await basicPdfCheck(file);
    if (!check.ok) {
      setStatus("error");
      setMessage(check.error);
      return;
    }

    // Hash (fingerprint)
    const sha = await sha256Hex(file);

    // 1) check duplicado
    const checkRes = await fetch(`/api/tickets/check?sha=${encodeURIComponent(sha)}`);
    const checkJson = await checkRes.json().catch(() => ({}));
    if (!checkRes.ok) {
      setStatus("error");
      setMessage(checkJson?.error || "Error revisando duplicados.");
      return;
    }
    if (checkJson.exists) {
      setStatus("error");
      setMessage("Entrada ya subida en Tixswap");
      return;
    }

    setStatus("uploading");

    // user
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setStatus("error");
      setMessage("Debes iniciar sesión para subir el ticket.");
      return;
    }

    // 2) upload storage (ruta por hash para que no se repita)
    const bucket = "ticket-pdfs";
    const storagePath = `tickets/${user.id}/${sha}.pdf`;

    const up = await supabase.storage.from(bucket).upload(storagePath, file, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: false,
    });

    if (up.error) {
      const msg = (up.error.message || "").toLowerCase();
      if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("409")) {
        setStatus("error");
        setMessage("Entrada ya subida en Tixswap");
        return;
      }
      setStatus("error");
      setMessage(up.error.message || "Error subiendo PDF.");
      return;
    }

    // 3) register DB
    const regRes = await fetch("/api/tickets/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha256: sha,
        storage_path: storagePath,
        event_id: draft.event_id,
        owner_user_id: user.id,
        original_filename: file.name,
        size_bytes: file.size,
        is_nominated: isNominated,
      }),
    });

    const regJson = await regRes.json().catch(() => ({}));
    if (!regRes.ok) {
      setStatus("error");
      setMessage(regJson?.error || "Error registrando ticket.");
      return;
    }

    // Guardamos info para Paso 3
    const nextDraft = {
      ...draft,
      ticket: {
        sha256: sha,
        storage_bucket: bucket,
        storage_path: storagePath,
        original_filename: file.name,
        size_bytes: file.size,
        is_nominated: isNominated,
      },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
    setDraft(nextDraft);

    setStatus("done");
    setMessage("PDF validado y subido ✅");
  }

  if (!draft) return null;

  return (
    <div className="tix-section">
      <div className="tix-container">
        {/* Header/Stepper mismo estilo */}
        <div className="tix-card p-6 tix-header-gradient">
          <div className="flex items-center justify-between">
            <div>
              <a href="/" className="text-sm font-medium text-white/90 hover:text-white">← Volver al inicio</a>
              <h1 className="mt-2 tix-title text-white">Vender entrada</h1>
              <p className="tix-subtitle text-white/80">Publica tu ticket en 3 pasos, rápido y seguro.</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-4">
              {steps.map((label, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div key={label} className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
                          isDone ? "bg-white/90 text-slate-900" : isActive ? "bg-white text-slate-900" : "bg-white/40 text-white",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>
                      <div className="text-white font-semibold">{label}</div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="mt-4 h-[3px] rounded-full bg-white/25 overflow-hidden">
                        <div className={["h-[3px] rounded-full bg-white transition-all duration-300", i < currentStep ? "w-full" : "w-0"].join(" ")} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card Paso 2 */}
        <div className="tix-card p-8 mt-6">
          <h2 className="text-2xl font-semibold text-slate-900">Archivo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sube el PDF del ticket. Validaremos formato y evitaremos duplicados.
          </p>

          {/* checkbox nominada */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-indigo-600"
                checked={isNominated}
                onChange={(e) => setIsNominated(e.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">Es nominada</div>
                <p className="mt-1 text-sm text-slate-600">
                  Si es nominada, al momento de la compra se abrirá un chat comprador↔vendedor para coordinar la nominación y subir el PDF re-nominado.
                </p>
              </div>
            </label>
          </div>

          {/* upload */}
          <div className="mt-6">
            <label className="text-sm font-medium text-slate-700">Subir PDF del ticket</label>
            <input
              type="file"
              accept="application/pdf"
              className="tix-input mt-2"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Tip: el e-ticket suele traer QR y código (ej: PuntoTicket). :contentReference[oaicite:2]{index=2}
            </p>
          </div>

          {/* acciones */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              className="tix-btn-secondary"
              onClick={() => router.push("/sell")}
            >
              Volver
            </button>

            <button
              type="button"
              className="tix-btn-primary"
              disabled={!file || status === "checking" || status === "uploading"}
              onClick={handleValidateAndUpload}
            >
              {status === "checking" ? "Validando..." : status === "uploading" ? "Subiendo..." : "Validar y subir"}
            </button>

            {status === "done" && (
              <button
                type="button"
                className="tix-btn-primary"
                onClick={() => router.push("/sell/confirm")}
              >
                Continuar
              </button>
            )}
          </div>

          {message && (
            <div
              className={[
                "mt-4 rounded-xl px-4 py-3 text-sm",
                status === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200",
              ].join(" ")}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
