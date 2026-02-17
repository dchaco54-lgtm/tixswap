"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";

function normKey(x = "") {
  return String(x)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function pick(map, keys) {
  for (const k of keys) {
    const v = map[normKey(k)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function parseDateValue(v) {
  if (!v && v !== 0) return null;

  // Date directo
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();

  // Excel serial number
  if (typeof v === "number" && isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) {
      const dt = new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  }

  const s = String(v).trim();
  if (!s) return null;

  // ISO o parseable
  const isoTry = new Date(s);
  if (!isNaN(isoTry.getTime())) return isoTry.toISOString();

  // dd/mm/yyyy hh:mm (Chile)
  const m = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = Number(m[4] || 0);
    const mi = Number(m[5] || 0);
    const dt = new Date(yyyy, mm - 1, dd, hh, mi, 0);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }

  return null;
}

function rowToEvent(row) {
  // Normaliza headers
  const map = {};
  for (const [k, v] of Object.entries(row || {})) {
    map[normKey(k)] = v;
  }

  const title = String(
    pick(map, ["titulo", "title", "evento", "nombre", "nombre_del_evento"])
  ).trim();

  const startsRaw = pick(map, [
    "fecha",
    "fecha_hora",
    "inicio",
    "starts_at",
    "start",
    "date",
    "datetime",
  ]);

  const venue = String(
    pick(map, ["ubicacion", "recinto", "venue", "lugar", "location"])
  ).trim();

  const city = String(pick(map, ["ciudad", "city"])).trim();
  const category = String(pick(map, ["categoria", "category"])).trim();
  const image_url = String(
    pick(map, ["url_de_imagen", "image_url", "imagen", "image", "url_imagen"])
  ).trim();

  const starts_at = parseDateValue(startsRaw);

  const payload = {
    title: title || null,
    starts_at: starts_at || null,
    venue: venue || null,
    city: city || null,
    category: category || null,
    image_url: image_url || null,
  };

  const errors = [];
  if (!payload.title) errors.push("Falta título");
  if (!payload.venue) errors.push("Falta recinto/ubicación");
  if (!payload.starts_at) errors.push("Falta fecha (o formato inválido)");

  return { payload, errors };
}

function isWarningsColumnMissingError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "PGRST204" ||
    (message.includes("schema cache") && message.includes("warnings")) ||
    message.includes("could not find the 'warnings' column")
  );
}

function isStatusColumnMissingError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "PGRST204" ||
    (message.includes("schema cache") && message.includes("status")) ||
    message.includes("could not find the 'status' column")
  );
}

function isRowLevelSecurityError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("row-level security") ||
    message.includes("violates row-level security policy")
  );
}

function getAdminEventsErrorMessage(error, fallbackMessage) {
  if (isRowLevelSecurityError(error)) {
    return "No tienes permisos para crear eventos (RLS). Verifica policies de events para admin.";
  }

  return error?.message || fallbackMessage;
}

export default function AdminEventsPage() {
  const router = useRouter();

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [hasWarningsColumn, setHasWarningsColumn] = useState(null);
  const [hasStatusColumn, setHasStatusColumn] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState({ warnings: "" });

  // Validar acceso admin
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
      } else {
      }
    };
    checkAuth();
  }, [router]);

  // Crear 1 evento
  const [form, setForm] = useState({
    title: "",
    starts_at_local: "",
    venue: "",
    city: "",
    category: "",
    image_url: "",
  });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Carga masiva
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState([]); // payloads validos
  const [bulkErrors, setBulkErrors] = useState([]); // [{rowIndex, errors, raw}]
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();


      if (prof?.user_type !== "admin") {
        router.push("/dashboard");
        return;
      }

      try {
        const { error: warningsError } = await supabase
          .from("events")
          .select("warnings")
          .limit(1);

        if (warningsError && isWarningsColumnMissingError(warningsError)) {
          setHasWarningsColumn(false);
        } else if (!warningsError) {
          setHasWarningsColumn(true);
        } else {
          setHasWarningsColumn(true);
          console.warn("[AdminEvents] warnings check error:", warningsError);
        }
      } catch (warningsCheckErr) {
        setHasWarningsColumn(true);
        console.warn("[AdminEvents] warnings check exception:", warningsCheckErr);
      }

      try {
        const { error: statusError } = await supabase
          .from("events")
          .select("status")
          .limit(1);

        if (statusError && isStatusColumnMissingError(statusError)) {
          setHasStatusColumn(false);
        } else if (!statusError) {
          setHasStatusColumn(true);
        } else {
          setHasStatusColumn(true);
          console.warn("[AdminEvents] status check error:", statusError);
        }
      } catch (statusCheckErr) {
        setHasStatusColumn(true);
        console.warn("[AdminEvents] status check exception:", statusCheckErr);
      }

      await loadEvents();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEvents = async () => {
    setLoadingEvents(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true })
        .limit(500);

      if (error) throw error;
      setEvents(data || []);
    } catch (e) {
      setErr(e?.message || "Error cargando eventos");
    } finally {
      setLoadingEvents(false);
    }
  };

  const openEditModal = (event) => {
    if (hasWarningsColumn !== true) return;
    setEditingEvent(event);
    setEditForm({ warnings: event?.warnings || "" });
  };

  const handleDeleteEvent = async (event) => {
    if (!event?.id) return;
    const ok = window.confirm(
      `¿Eliminar el evento \"${event.title || "sin nombre"}\"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) throw error;
      setMsg("Evento eliminado ✅");
      await loadEvents();
    } catch (e) {
      console.warn("[AdminEvents] delete error:", e);
      setErr("No se pudo eliminar el evento.");
    }
  };

  const handleUpdateWarnings = async () => {
    if (!editingEvent) return;
    try {
      const { error } = await supabase
        .from("events")
        .update({ warnings: editForm.warnings.trim() || null })
        .eq("id", editingEvent.id);
      
      if (error) throw error;
      
      setMsg("Advertencias actualizadas ✅");
      setEditingEvent(null);
      await loadEvents();
    } catch (e) {
      setErr(e?.message || "Error actualizando advertencias");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    setErr("");

    try {
      const starts_at = form.starts_at_local
        ? new Date(form.starts_at_local).toISOString()
        : null;

      const payload = {
        title: form.title.trim(),
        starts_at,
        venue: form.venue.trim(),
        city: form.city.trim() || null,
        category: form.category.trim() || null,
        image_url: form.image_url.trim() || null,
      };
      if (hasWarningsColumn === true) {
        payload.warnings = null; // Se edita después en el modal
      }
      if (hasStatusColumn === true) {
        payload.status = "published";
      }

      const { error } = await supabase.from("events").insert(payload);
      if (error) throw error;

      setMsg("Evento creado ✅");
      setForm({
        title: "",
        starts_at_local: "",
        venue: "",
        city: "",
        category: "",
        image_url: "",
      });
      await loadEvents();
    } catch (e2) {
      setErr(getAdminEventsErrorMessage(e2, "Error creando evento"));
    } finally {
      setCreating(false);
    }
  };

  const parseBulkFile = async (file) => {
    setMsg("");
    setErr("");
    setBulkFileName(file?.name || "");
    setBulkRows([]);
    setBulkErrors([]);
    setBulkProgress({ done: 0, total: 0 });

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) throw new Error("El archivo no tiene hojas.");

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows.length) throw new Error("El archivo está vacío.");

      const valids = [];
      const errs = [];

      // detectar duplicados dentro del archivo (title+starts_at+venue)
      const seen = new Set();

      rows.forEach((r, idx) => {
        const { payload, errors } = rowToEvent(r);
        const key = `${payload.title || ""}__${payload.starts_at || ""}__${
          payload.venue || ""
        }`
          .toLowerCase()
          .trim();

        if (!errors.length) {
          if (seen.has(key)) {
            errs.push({
              rowIndex: idx + 2, // +2 por header (aprox)
              errors: ["Duplicado dentro del archivo (mismo título/fecha/recinto)"],
              raw: r,
            });
          } else {
            seen.add(key);
            valids.push(payload);
          }
        } else {
          errs.push({ rowIndex: idx + 2, errors, raw: r });
        }
      });

      setBulkRows(valids);
      setBulkErrors(errs);
      setMsg(
        `Archivo listo: ${valids.length} válidos${errs.length ? ` · ${errs.length} con error` : ""
        }`
      );
    } catch (e) {
      setErr(e?.message || "No pude leer el archivo");
    }
  };

  const bulkImport = async () => {
    if (!bulkRows.length) return;
    setBulkImporting(true);
    setErr("");
    setMsg("");
    setBulkProgress({ done: 0, total: bulkRows.length });

    try {
      const CHUNK = 50;
      let done = 0;

      for (let i = 0; i < bulkRows.length; i += CHUNK) {
        const chunk = bulkRows.slice(i, i + CHUNK);
        const payload = hasStatusColumn === true
          ? chunk.map((row) => ({ ...row, status: "published" }))
          : chunk;
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;

        done += chunk.length;
        setBulkProgress({ done, total: bulkRows.length });
      }

      setMsg(`Importación lista ✅ (${bulkRows.length} eventos)`);
      setBulkRows([]);
      setBulkErrors([]);
      setBulkFileName("");
      await loadEvents();
    } catch (e) {
      setErr(e?.message || "Falló la importación masiva");
    } finally {
      setBulkImporting(false);
    }
  };

  const preview = useMemo(() => bulkRows.slice(0, 10), [bulkRows]);

  return (
    <div className="min-h-screen bg-[#f4f7ff]">
      <div className="tix-container py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Panel de eventos
            </h1>
            <p className="text-slate-600 mt-1">
              Crea eventos manualmente o cárgalos masivamente por Excel.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="tix-btn-ghost"
          >
            Volver
          </button>
        </div>

        {(msg || err) && (
          <div className="mb-6">
            {msg && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 font-semibold">
                {msg}
              </div>
            )}
            {err && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold mt-3">
                {err}
              </div>
            )}
          </div>
        )}

        {hasWarningsColumn === false && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 font-semibold">
            Tu BD aún no tiene la columna &apos;warnings&apos;. Ejecuta la migración MIGRATION_EVENTS_WARNINGS.sql y recarga.
          </div>
        )}

        {/* Crear 1 */}
        <div className="tix-card p-6">
          <h2 className="text-xl font-extrabold text-slate-900 mb-4">
            Crear nuevo evento
          </h2>

          <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4">
            <input
              className="tix-input"
              placeholder="Título del evento"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />

            <input
              className="tix-input"
              type="datetime-local"
              value={form.starts_at_local}
              onChange={(e) =>
                setForm({ ...form, starts_at_local: e.target.value })
              }
              required
            />

            <input
              className="tix-input"
              placeholder="Ubicación (recinto)"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              required
            />

            <input
              className="tix-input"
              placeholder="Ciudad (opcional)"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />

            <input
              className="tix-input"
              placeholder="Categoría (opcional)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />

            <input
              className="tix-input"
              placeholder="URL de imagen (opcional)"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />

            <div className="md:col-span-2 flex items-center gap-3 mt-2">
              <button
                type="submit"
                disabled={creating}
                className="tix-btn-primary"
              >
                {creating ? "Creando…" : "Crear evento"}
              </button>
            </div>
          </form>
        </div>

        {/* Carga masiva */}
        <div className="tix-card p-6 mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Carga masiva (Excel / CSV)
              </h2>
              <p className="text-slate-600 mt-1">
                Sube un <b>.xlsx</b> o <b>.csv</b> con columnas tipo:{" "}
                <code className="text-slate-700">
                  titulo, fecha, recinto, ciudad, categoria, url_imagen
                </code>{" "}
                (los nombres pueden variar, igual los detecto).
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseBulkFile(f);
              }}
            />

            {bulkFileName && (
              <div className="text-sm text-slate-700">
                Archivo: <b>{bulkFileName}</b> · Válidos:{" "}
                <b>{bulkRows.length}</b> · Con error:{" "}
                <b>{bulkErrors.length}</b>
              </div>
            )}

            {!!preview.length && (
              <div className="mt-2 overflow-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Título</th>
                      <th className="text-left px-4 py-3">Fecha</th>
                      <th className="text-left px-4 py-3">Recinto</th>
                      <th className="text-left px-4 py-3">Ciudad</th>
                      <th className="text-left px-4 py-3">Categoría</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {r.title}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {r.starts_at
                            ? new Date(r.starts_at).toLocaleString("es-CL", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.venue}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {r.city || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {r.category || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!!bulkErrors.length && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-rose-700">
                  Ver errores ({bulkErrors.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {bulkErrors.slice(0, 25).map((e, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 text-sm"
                    >
                      <b>Fila {e.rowIndex}:</b> {e.errors.join(" · ")}
                    </div>
                  ))}
                  {bulkErrors.length > 25 && (
                    <div className="text-xs text-slate-500">
                      Mostrando 25 de {bulkErrors.length}.
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={bulkImport}
                disabled={bulkImporting || bulkRows.length === 0}
                className="tix-btn-primary"
              >
                {bulkImporting
                  ? `Importando… (${bulkProgress.done}/${bulkProgress.total})`
                  : `Importar ${bulkRows.length || ""} eventos`}
              </button>

              <button
                onClick={() => {
                  setBulkFileName("");
                  setBulkRows([]);
                  setBulkErrors([]);
                  setBulkProgress({ done: 0, total: 0 });
                }}
                className="tix-btn-ghost"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Lista eventos */}
        <div className="tix-card p-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-extrabold text-slate-900">
              Eventos ({events.length})
            </h2>
            <button onClick={loadEvents} className="tix-btn-ghost">
              Recargar
            </button>
          </div>

          {loadingEvents ? (
            <p className="text-slate-600">Cargando…</p>
          ) : events.length === 0 ? (
            <p className="text-slate-600">Aún no hay eventos.</p>
          ) : (
            <div className="overflow-auto rounded-2xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3">Título</th>
                    <th className="text-left px-4 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Recinto</th>
                    <th className="text-left px-4 py-3">Ciudad</th>
                    <th className="text-left px-4 py-3">Categoría</th>
                    <th className="text-left px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {ev.title}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ev.starts_at
                          ? new Date(ev.starts_at).toLocaleString("es-CL", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{ev.venue}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {ev.city || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ev.category || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/events/${ev.id}/edit`)}
                            title="Editar evento"
                            className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 hover:text-blue-700 hover:border-blue-200"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDeleteEvent(ev)}
                            title="Eliminar evento"
                            className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 hover:text-rose-700 hover:border-rose-200"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M6 6l1 14h10l1-14" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>

                          {hasWarningsColumn === true && (
                            <button
                              onClick={() => openEditModal(ev)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                            >
                              Advertencias
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de edición de advertencias */}
        {hasWarningsColumn === true && editingEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-xl">
              <h3 className="text-xl font-bold mb-4">
                Editar advertencias: {editingEvent.title}
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Advertencias/Recomendaciones (opcional)
                </label>
                <textarea
                  value={editForm.warnings}
                  onChange={(e) => setEditForm({ warnings: e.target.value })}
                  placeholder="Ej: IMPORTANTE: Las entradas NO son renominables. Asegúrate que el nombre coincida con tu documento de identidad."
                  className="w-full p-4 border border-slate-300 rounded-lg font-mono text-base h-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Soporta saltos de línea. Esto se mostrará en la página del evento con icono de advertencia.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpdateWarnings}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300 font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
