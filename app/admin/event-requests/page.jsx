"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function fmtCL(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function normalizePayload(payload) {
  return payload && typeof payload === "object" ? payload : {};
}

function extractSteps(payload) {
  const base = normalizePayload(payload);
  const step1 = base.step1 && typeof base.step1 === "object" ? base.step1 : base;
  const step2 = base.step2 && typeof base.step2 === "object"
    ? base.step2
    : (base.ticketUpload && typeof base.ticketUpload === "object" ? base.ticketUpload : {});
  const step3 = base.step3 && typeof base.step3 === "object" ? base.step3 : {};
  return { step1, step2, step3 };
}

export default function AdminEventRequestsPage() {
  const router = useRouter();

  const [boot, setBoot] = useState(true);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [formById, setFormById] = useState({});

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  };

  const ensureAdmin = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return { ok: false };

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.user_type !== "admin") return { ok: false };
    return { ok: true };
  };

  const loadRequests = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("event_requests")
        .select("id, created_at, status, requested_event_name, requested_event_extra, user_email, user_id, payload, admin_notes")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      setRequests(rows);

      setFormById((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          if (!next[r.id]) {
            next[r.id] = {
              eventId: "",
              title: r.requested_event_name || "",
              starts_at_local: "",
              venue: "",
              city: "",
              category: "",
              image_url: "",
              adminNotes: r.admin_notes || "",
            };
          }
        }
        return next;
      });
    } catch (e) {
      setErr(e?.message || "Error cargando solicitudes");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setBoot(true);
      const admin = await ensureAdmin();
      if (!admin.ok) {
        router.push("/dashboard");
        return;
      }
      setBoot(false);
      await loadRequests();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateForm = (id, patch) => {
    setFormById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...(patch || {}) },
    }));
  };

  const handleApprove = async (reqId) => {
    setErr("");
    setMsg("");

    const form = formById[reqId] || {};
    const eventId = String(form.eventId || "").trim() || null;

    if (!eventId) {
      if (!String(form.title || "").trim()) {
        setErr("Falta título del evento.");
        return;
      }
      if (!String(form.starts_at_local || "").trim()) {
        setErr("Falta fecha/hora del evento.");
        return;
      }
      if (!String(form.venue || "").trim()) {
        setErr("Falta recinto/ubicación.");
        return;
      }
    }

    const startsAt = form.starts_at_local
      ? new Date(form.starts_at_local).toISOString()
      : null;

    const payload = {
      requestId: reqId,
      eventId,
      event: eventId
        ? null
        : {
            title: String(form.title || "").trim(),
            starts_at: startsAt,
            venue: String(form.venue || "").trim(),
            city: String(form.city || "").trim() || null,
            category: String(form.category || "").trim() || null,
            image_url: String(form.image_url || "").trim() || null,
          },
      adminNotes: String(form.adminNotes || "").trim() || null,
    };

    setBusyId(reqId);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErr("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch("/api/admin/event-requests/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || "No se pudo aprobar la solicitud.");
        return;
      }

      setMsg("Solicitud aprobada y publicación creada ✅");
      await loadRequests();
    } catch (e) {
      setErr(e?.message || "No se pudo aprobar la solicitud.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reqId) => {
    setErr("");
    setMsg("");

    const form = formById[reqId] || {};
    const notes = String(form.adminNotes || "").trim();

    if (!notes) {
      setErr("Para rechazar debes indicar un motivo en notas internas.");
      return;
    }

    if (!confirm("¿Seguro que deseas rechazar esta solicitud?")) return;

    setBusyId(reqId);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErr("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch("/api/admin/event-requests/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: reqId, adminNotes: notes }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || "No se pudo rechazar la solicitud.");
        return;
      }

      setMsg("Solicitud rechazada ✅");
      await loadRequests();
    } catch (e) {
      setErr(e?.message || "No se pudo rechazar la solicitud.");
    } finally {
      setBusyId(null);
    }
  };

  const hasRequests = useMemo(() => (requests || []).length > 0, [requests]);

  if (boot) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Validando permisos…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Solicitudes de evento
            </h1>
            <p className="text-sm text-slate-500">
              Cola de solicitudes pendientes para crear evento y publicar ticket.
            </p>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
          >
            Volver al panel
          </button>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {msg}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando solicitudes…</p>
        ) : !hasRequests ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No hay solicitudes pendientes.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const { step1, step2, step3 } = extractSteps(req.payload);
              const price = step3?.finalPrice ?? step1?.price ?? null;
              const originalPrice = step1?.originalPrice ?? step1?.original_price ?? null;
              const ticketUploadId = step2?.ticketUploadId || step1?.ticketUploadId || null;
              const isNominada = !!(step2?.isNominada || step2?.is_nominada || step2?.is_nominated);
              const form = formById[req.id] || {};

              return (
                <div key={req.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">{fmtCL(req.created_at)}</div>
                      <h2 className="text-lg font-semibold text-slate-900 mt-1">
                        {req.requested_event_name}
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">
                        {req.requested_event_extra || "Sin extra"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Usuario: {req.user_email || "—"}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">ID: {req.id}</div>
                  </div>

                  <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="font-semibold text-slate-700">Datos del ticket</div>
                      <div className="mt-2 text-slate-700">
                        <div>Precio: {price ? `$${Number(price).toLocaleString("es-CL")}` : "—"}</div>
                        <div>Precio original: {originalPrice ? `$${Number(originalPrice).toLocaleString("es-CL")}` : "—"}</div>
                        <div>Sector: {step1?.sector || "—"}</div>
                        <div>Fila: {step1?.fila || "—"}</div>
                        <div>Asiento: {step1?.asiento || "—"}</div>
                        <div>TicketUploadId: {ticketUploadId || "—"}</div>
                        <div>Nominada: {isNominada ? "Sí" : "No"}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="font-semibold text-slate-700">Resumen PDF</div>
                      <div className="mt-2 text-slate-700">
                        <div>Evento PDF: {step2?.summary?.event_name || "—"}</div>
                        <div>Recinto PDF: {step2?.summary?.venue || "—"}</div>
                        <div>Sector PDF: {step2?.summary?.sector || "—"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    <input
                      className="tix-input"
                      placeholder="Event ID existente (opcional)"
                      value={form.eventId || ""}
                      onChange={(e) => updateForm(req.id, { eventId: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      placeholder="Título del evento"
                      value={form.title || ""}
                      onChange={(e) => updateForm(req.id, { title: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      type="datetime-local"
                      value={form.starts_at_local || ""}
                      onChange={(e) => updateForm(req.id, { starts_at_local: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      placeholder="Recinto"
                      value={form.venue || ""}
                      onChange={(e) => updateForm(req.id, { venue: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      placeholder="Ciudad"
                      value={form.city || ""}
                      onChange={(e) => updateForm(req.id, { city: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      placeholder="Categoría"
                      value={form.category || ""}
                      onChange={(e) => updateForm(req.id, { category: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      placeholder="URL de imagen"
                      value={form.image_url || ""}
                      onChange={(e) => updateForm(req.id, { image_url: e.target.value })}
                    />
                    <input
                      className="tix-input"
                      placeholder="Notas internas (requerido para rechazar)"
                      value={form.adminNotes || ""}
                      onChange={(e) => updateForm(req.id, { adminNotes: e.target.value })}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="tix-btn-primary"
                      disabled={busyId === req.id}
                      onClick={() => handleApprove(req.id)}
                    >
                      {busyId === req.id ? "Procesando…" : "Crear evento y publicar"}
                    </button>
                    <button
                      type="button"
                      className="tix-btn-secondary"
                      disabled={busyId === req.id}
                      onClick={() => handleReject(req.id)}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
