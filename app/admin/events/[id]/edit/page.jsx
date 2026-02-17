"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const TOAST_TTL = 3200;

const CHANGE_TYPES = [
  { value: "reprogramado", label: "Reprogramado (cambio de fecha/hora)" },
  { value: "recinto", label: "Cambio de recinto" },
  { value: "menor", label: "Actualización menor" },
  { value: "otro", label: "Otro" },
];

const FIELD_LABELS = {
  title: "Nombre del evento",
  starts_at: "Fecha y hora",
  venue: "Recinto",
  city: "Ciudad",
  image_url: "Imagen/banner",
};

function normalizeString(value) {
  const str = String(value ?? "").trim();
  return str || "";
}

function toLocalDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toLocalTimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(11, 16);
}

function combineDateTime(date, time) {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminEventEditPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    venue: "",
    city: "",
    image_url: "",
  });

  const [changeType, setChangeType] = useState("menor");
  const [changeTypeDetail, setChangeTypeDetail] = useState("");
  const [messageToUsers, setMessageToUsers] = useState("");

  const [notifyBuyers, setNotifyBuyers] = useState(true);
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [notifySellers, setNotifySellers] = useState(false);

  const [preview, setPreview] = useState(null);
  const [audience, setAudience] = useState({
    buyersCount: 0,
    subscribersCount: 0,
    sellersCount: 0,
    totalUniqueCount: 0,
  });
  const [audienceLoading, setAudienceLoading] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), TOAST_TTL);
  }, []);

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setPreview(null);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", data.session.user.id)
        .single();

      const role = profile?.user_type;
      if (role && role !== "admin") {
        router.push("/dashboard");
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    let active = true;

    const loadEvent = async () => {
      if (!eventId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}?_t=${Date.now()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error("No pudimos cargar el evento");
        }

        if (!active) return;
        const ev = json?.event || null;
        setEvent(ev);
        setForm({
          title: ev?.title || "",
          date: toLocalDateInput(ev?.starts_at),
          time: toLocalTimeInput(ev?.starts_at),
          venue: ev?.venue || "",
          city: ev?.city || "",
          image_url: ev?.image_url || "",
        });
      } catch (err) {
        console.warn("[AdminEventEdit] load error:", err);
        showToast("err", "No pudimos cargar el evento.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadEvent();

    return () => {
      active = false;
    };
  }, [eventId, showToast]);

  const diff = useMemo(() => {
    if (!event) return [];
    const nextStartsAt = combineDateTime(form.date, form.time);
    const eventStartsAtIso = event?.starts_at
      ? new Date(event.starts_at).toISOString()
      : "";
    const changes = [];

    if (normalizeString(event.title) !== normalizeString(form.title)) {
      changes.push({
        field: "title",
        before: event.title || "—",
        after: normalizeString(form.title) || "—",
      });
    }

    if (eventStartsAtIso !== nextStartsAt) {
      changes.push({
        field: "starts_at",
        before: formatDateTime(event.starts_at),
        after: formatDateTime(nextStartsAt),
      });
    }

    if (normalizeString(event.venue) !== normalizeString(form.venue)) {
      changes.push({
        field: "venue",
        before: event.venue || "—",
        after: normalizeString(form.venue) || "—",
      });
    }

    if (normalizeString(event.city) !== normalizeString(form.city)) {
      changes.push({
        field: "city",
        before: event.city || "—",
        after: normalizeString(form.city) || "—",
      });
    }

    if (normalizeString(event.image_url) !== normalizeString(form.image_url)) {
      changes.push({
        field: "image_url",
        before: event.image_url || "—",
        after: normalizeString(form.image_url) || "—",
      });
    }

    return changes;
  }, [event, form]);

  const loadAudience = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("No autorizado");

      const url = new URL(`/api/admin/events/${eventId}/audience`, window.location.origin);
      url.searchParams.set("includeSellers", notifySellers ? "true" : "false");
      url.searchParams.set("includeBuyers", notifyBuyers ? "true" : "false");
      url.searchParams.set("includeSubscribers", notifySubscribers ? "true" : "false");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("No pudimos calcular audiencia");
      setAudience({
        buyersCount: json?.buyersCount || 0,
        subscribersCount: json?.subscribersCount || 0,
        sellersCount: json?.sellersCount || 0,
        totalUniqueCount: json?.totalUniqueCount || 0,
      });
    } catch (err) {
      console.warn("[AdminEventEdit] audience error:", err);
      showToast("err", "No pudimos calcular la audiencia.");
    } finally {
      setAudienceLoading(false);
    }
  }, [eventId, notifySellers, notifyBuyers, notifySubscribers, showToast]);

  const handlePreview = async () => {
    if (!diff.length) {
      showToast("err", "No hay cambios para revisar.");
      return;
    }

    if (!form.title.trim() || !form.date || !form.time) {
      showToast("err", "Completa los campos obligatorios.");
      return;
    }

    const nextStartsAt = combineDateTime(form.date, form.time);
    if (!nextStartsAt) {
      showToast("err", "Fecha u hora inválida.");
      return;
    }

    setPreview({
      updates: {
        title: normalizeString(form.title),
        starts_at: nextStartsAt,
        venue: normalizeString(form.venue),
        city: normalizeString(form.city),
        image_url: normalizeString(form.image_url),
      },
      changes: diff,
    });

    await loadAudience();
  };

  useEffect(() => {
    if (!preview) return;
    loadAudience();
  }, [preview, loadAudience]);

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("No autorizado");

      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          updates: preview.updates,
          changeType,
          changeTypeDetail: changeType === "otro" ? changeTypeDetail : "",
          messageToUsers,
          notifyBuyers,
          notifySubscribers,
          notifySellers,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No pudimos guardar");
      }

      showToast("ok", "Evento actualizado ✅");
      if (json?.emailSuppressed) {
        showToast("ok", "Emails pausados por límite anti-spam.");
      }
      setTimeout(() => router.push("/admin/events"), 900);
    } catch (err) {
      console.warn("[AdminEventEdit] save error:", err);
      showToast("err", "No pudimos guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7ff]">
      <div className="tix-container py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Editar evento
            </h1>
            <p className="text-slate-600 mt-1">
              Ajusta la información y revisa el impacto antes de guardar.
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/events")}
            className="tix-btn-ghost"
          >
            Volver al listado
          </button>
        </div>

        {toast && (
          <div
            className={`mb-5 rounded-2xl px-4 py-3 font-semibold border ${
              toast.type === "err"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {loading ? (
          <div className="tix-card p-6">Cargando evento...</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="tix-card p-6">
              <h2 className="text-xl font-extrabold text-slate-900 mb-4">
                Información del evento
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Nombre del evento
                  </label>
                  <input
                    className="tix-input mt-2"
                    value={form.title}
                    onChange={(e) => updateForm({ title: e.target.value })}
                    placeholder="Nombre del evento"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Fecha
                    </label>
                    <input
                      className="tix-input mt-2"
                      type="date"
                      value={form.date}
                      onChange={(e) => updateForm({ date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Hora
                    </label>
                    <input
                      className="tix-input mt-2"
                      type="time"
                      value={form.time}
                      onChange={(e) => updateForm({ time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Lugar / Recinto
                  </label>
                  <input
                    className="tix-input mt-2"
                    value={form.venue}
                    onChange={(e) => updateForm({ venue: e.target.value })}
                    placeholder="Ej: Movistar Arena"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Ciudad
                  </label>
                  <input
                    className="tix-input mt-2"
                    value={form.city}
                    onChange={(e) => updateForm({ city: e.target.value })}
                    placeholder="Ej: Santiago"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Imagen/Banner (URL)
                  </label>
                  <input
                    className="tix-input mt-2"
                    value={form.image_url}
                    onChange={(e) => updateForm({ image_url: e.target.value })}
                    placeholder="https://..."
                  />
                  {form.image_url && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="tix-card p-6">
                <h2 className="text-xl font-extrabold text-slate-900 mb-4">
                  Tipo de cambio
                </h2>
                <div className="flex flex-col gap-3">
                  {CHANGE_TYPES.map((item) => (
                    <label
                      key={item.value}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${
                        changeType === item.value
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="changeType"
                        checked={changeType === item.value}
                        onChange={() => {
                          setChangeType(item.value);
                          setPreview(null);
                        }}
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>

                {changeType === "otro" && (
                  <div className="mt-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Detalle del cambio
                    </label>
                    <input
                      className="tix-input mt-2"
                      value={changeTypeDetail}
                      onChange={(e) => {
                        setChangeTypeDetail(e.target.value);
                        setPreview(null);
                      }}
                      placeholder="Describe el cambio"
                    />
                  </div>
                )}
              </div>

              <div className="tix-card p-6">
                <h2 className="text-xl font-extrabold text-slate-900 mb-4">
                  Mensaje para usuarios
                </h2>
                <textarea
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={messageToUsers}
                  onChange={(e) => {
                    setMessageToUsers(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="Ej: Cambio oficial informado por productora…"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreview}
                  className="tix-btn-primary w-full"
                  disabled={saving}
                >
                  Revisar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {preview && (
          <div className="tix-card p-6 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                Resumen de cambios
              </h2>
              <div className="text-sm text-slate-500">
                {preview.changes.length} cambio(s)
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {preview.changes.map((c) => (
                <div
                  key={c.field}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="text-sm font-semibold text-slate-800">
                    {FIELD_LABELS[c.field] || c.field}
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                      <div className="text-xs uppercase text-slate-400">Antes</div>
                      <div className="font-medium text-slate-700">{c.before}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                      <div className="text-xs uppercase text-emerald-400">Después</div>
                      <div className="font-semibold text-emerald-700">{c.after}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-800 mb-2">
                  Audiencia que será notificada
                </h3>
                {audienceLoading ? (
                  <div className="text-sm text-slate-500">Calculando...</div>
                ) : (
                  <div className="space-y-1 text-sm text-slate-700">
                    <div>Compradores: <b>{audience.buyersCount}</b></div>
                    <div>Suscritos: <b>{audience.subscribersCount}</b></div>
                    <div>Vendedores: <b>{audience.sellersCount}</b></div>
                    <div className="mt-2 text-base text-slate-900">
                      Total deduplicado: <b>{audience.totalUniqueCount}</b>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-800 mb-2">
                  Notificaciones
                </h3>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifyBuyers && notifySubscribers}
                      onChange={(e) => {
                        setNotifyBuyers(e.target.checked);
                        setNotifySubscribers(e.target.checked);
                        setPreview((prev) => (prev ? { ...prev } : prev));
                      }}
                    />
                    Notificar a compradores y suscritos
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifySellers}
                      onChange={(e) => {
                        setNotifySellers(e.target.checked);
                        setPreview((prev) => (prev ? { ...prev } : prev));
                      }}
                    />
                    Notificar también a vendedores con publicaciones activas
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Emails con límite anti-spam (máximo 1 cada 30 min por usuario/evento).
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                className="tix-btn-primary"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Confirmar y guardar"}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="tix-btn-ghost"
              >
                Volver a editar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
