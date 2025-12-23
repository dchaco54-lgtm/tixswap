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

  const headBuf = await file.slice(0, 5).arrayBuffer();
  const head = new TextDecoder().decode(headBuf);
  if (head !== "%PDF-") return { ok: false, error: "Archivo inválido: no parece PDF real." };

  const chunk = await file.slice(0, 200000).text().catch(() => "");
  if (chunk.includes("/Encrypt")) {
    return { ok: false, error: "PDF protegido/cifrado. Sube el ticket sin clave." };
  }

  return { ok: true };
}

export default function SellFilePage() {
  const router = useRouter();

  const steps = ["Detalles", "Archivo", "Confirmar"];
  const currentStep = 1;

  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(null);

  const [file, setFile] = useState(null);
  const [isNominated, setIsNominated] = useState(false);

  const [status, setStatus] = useState("idle"); // idle|checking|uploading|done|error
  const [message, setMessage] = useState("");

  // ✅ carga segura del draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        router.replace("/sell");
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed?.event_id) {
        router.replace("/sell");
        return;
      }

      setDraft(parsed);
      setReady(true);
    } catch (e) {
      console.error("[sell/file] draft parse error:", e);
      router.replace("/sell");
    }
  }, [router]);

  const canContinue = useMemo(() => status === "done", [status]);

  async function handleValidateAndUpload() {
    try {
      setMessage("");
      setStatus("checking");

      const check = await basicPdfCheck(file);
      if (!check.ok) {
        setStatus("error");
        setMessage(check.error);
        return;
      }

      const sha = await sha256Hex(file);

      // 1) dedupe check
      const checkRes = await fetch(`/api/tickets/check?sha=${encodeURIComponent(sha)}`);
      const checkJson = await checkRes.json().catch(() => ({}));
      if (!checkRes.ok) {
        setStatus("error");
        setMessage(checkJson?.error || "Error revisando duplicados (/api/tickets/check).");
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

      // 2) upload storage
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
        setMessage(regJson?.error || "Error registrando ticket (/api/tickets/register).");
        return;
      }

      // Guardar para Paso 3
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
    } catch (e) {
      console.error("[sell/file] validate/upload error:", e);
      setStatus("error");
      setMessage(e?.message || "Error inesperado en el Paso 2.");
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Stepper header (mismo look) */}
        <div className="mb-8 overflow-hidden rounded-3xl shadow-soft">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-10">
            <h1 className="text-4xl font-bold text-white">Vender entrada</h1>
            <p className="mt-2 text-white/80">Publica tu ticket en 3 pasos, rápido y seguro.</p>

            <div className="mt-7 flex items-center">
              {steps.map((s, i) => {
                const active = i === currentStep;
                const done = i < currentStep;

                return (
                  <div key={s} className="flex flex-1 items-center">
                    <div className="flex items-center gap-4">
                      <div
                        className={[
                          "flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold",
                          active
                            ? "bg-white text-blue-700"
                            : done
                            ? "bg-white/80 text-blue-800"
                            : "bg-white/25 text-white",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>
                      <div className="text-lg font-semibold text-white">{s}</div>
                    </div>

                    {i < steps.length - 1 && (
                      <div className="mx-6 h-[3px] flex-1 rounded-full bg-white/25">
                        <div
                          className={[
                            "h-[3px] rounded-full bg-white transition-all duration-300",
                            i < currentStep ? "w-full" : "w-0",
                          ].join(" ")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="tix-card p-8">
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
            <p className="mt-2 text-xs text-slate-500">Máx 8MB. Validamos PDF real + anti-duplicado.</p>
          </div>

          {/* acciones con UX correcta */}
          <div className="mt-6 flex items-center justify-between">
            <button type="button" className="tix-btn-secondary" onClick={() => router.push("/sell")}>
              Volver
            </button>

            <div className="flex items-center gap-3">
              {/* VALIDAR: azul al inicio, después pasa a "Validado ✅" plomito */}
              <button
                type="button"
                className={status === "done" ? "tix-btn-secondary" : "tix-btn-primary"}
                disabled={!file || status === "checking" || status === "uploading" || status === "done"}
                onClick={handleValidateAndUpload}
                title={status === "done" ? "Ya está validado" : "Valida y sube el PDF para continuar"}
              >
                {status === "checking"
                  ? "Validando..."
                  : status === "uploading"
                  ? "Subiendo..."
                  : status === "done"
                  ? "Validado ✅"
                  : "Validar y subir"}
              </button>

              {/* CONTINUAR: plomito hasta validar, luego azul */}
              <button
                type="button"
                className={status === "done" ? "tix-btn-primary" : "tix-btn-secondary"}
                disabled={!canContinue}
                onClick={() => router.push("/sell/confirm")}
                title={!canContinue ? "Primero valida y sube el PDF" : "Listo, pasemos al paso 3"}
              >
                Continuar
              </button>
            </div>
          </div>

          {status !== "done" && (
            <p className="mt-3 text-xs text-slate-500">Para continuar, primero debes validar y subir el PDF.</p>
          )}

          {message && (
            <div
              className={[
                "mt-4 rounded-xl px-4 py-3 text-sm border",
                status === "error"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-green-50 text-green-700 border-green-200",
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
