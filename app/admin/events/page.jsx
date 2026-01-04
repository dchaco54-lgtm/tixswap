// app/admin/events/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** Helpers */
function norm(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // fallback
  return d.toISOString();
}

function formatEventDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(iso);
  }
}

function makeEventKey(title, starts_at_iso) {
  const t = norm(title);
  const d = new Date(starts_at_iso);
  const kDate = Number.isNaN(d.getTime()) ? String(starts_at_iso || "") : d.toISOString().slice(0, 16); // minuto
  return `${t}|${kDate}`;
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminEventsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");

  const [newEvent, setNewEvent] = useState({
    title: "",
    starts_at: "",
    venue: "",
    city: "",
    category: "",
    image_url: "",
  });

  const [editingEvent, setEditingEvent] = useState(null); // { id, title, starts_at(datetime-local), venue, city, category, image_url }
  const [loading, setLoading] = useState(false);

  /** Import masivo */
  const [importing, setImporting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importPreview, setImportPreview] = useState(null);
  // importPreview = {
  //   filename, totalRows,
  //   validPayloads: [{payload, rowIndex, key}],
  //   invalidRows: [{rowIndex, reason}],
  //   duplicateRows: [{rowIndex, reason}],
  // }

  /** Admin guard (ZIP-style): profiles.role === "admin" */
  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.replace(`/login?redirectTo=${encodeURIComponent("/admin/events")}`);
        return;
      }

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.warn("[admin/events] profiles role error:", profileErr);
        router.replace("/dashboard");
        return;
      }

      if (profileRow?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);
      setCheckingAdmin(false);
      await fetchEvents();
    };

    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[admin/events] fetchEvents error:", error);
      setEvents([]);
      return;
    }
    setEvents(Array.isArray(data) ? data : []);
  }

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return events;
    return (events || []).filter((ev) => {
      const hay = norm(
        `${ev?.title || ""} ${ev?.venue || ev?.location || ""} ${ev?.city || ""} ${ev?.category || ""}`
      );
      return hay.includes(q);
    });
  }, [events, search]);

  /** Create event */
  const createEvent = async () => {
    const title = newEvent.title.trim();
    const venue = newEvent.venue.trim();
    const starts_at_iso = datetimeLocalToIso(newEvent.starts_at);

    if (!title || !venue || !starts_at_iso) {
      alert("Completa: Título, Fecha/Hora y Ubicación (recinto)");
      return;
    }

    setLoading(true);

    const payload = {
      title,
      starts_at: starts_at_iso,
      venue,
      city: newEvent.city.trim() || null,
      category: newEvent.category.trim() || null,
      image_url: newEvent.image_url.trim() || null,
    };

    const { data, error } = await supabase
      .from("events")
      .insert([payload])
      .select("*")
      .single();

    setLoading(false);

    if (error) {
      console.error("[admin/events] createEvent error:", error);
      alert(`Error al crear evento: ${error.message}`);
      return;
    }

    setNewEvent({ title: "", starts_at: "", venue: "", city: "", category: "", image_url: "" });
    await fetchEvents();
    alert(`Evento creado ✅ (${data?.title || "OK"})`);
  };

  const startEdit = (ev) => {
    setEditingEvent({
      id: ev.id,
      title: ev?.title || "",
      starts_at: isoToDatetimeLocal(ev?.starts_at),
      venue: ev?.venue || ev?.location || "",
      city: ev?.city || "",
      category: ev?.category || "",
      image_url: ev?.image_url || "",
    });
  };

  /** Update event */
  const updateEvent = async () => {
    if (!editingEvent?.id) return;

    const title = (editingEvent.title || "").trim();
    const venue = (editingEvent.venue || "").trim();
    const starts_at_iso = datetimeLocalToIso(editingEvent.starts_at);

    if (!title || !venue || !starts_at_iso) {
      alert("Completa: Título, Fecha/Hora y Ubicación (recinto)");
      return;
    }

    setLoading(true);

    const payload = {
      title,
      starts_at: starts_at_iso,
      venue,
      city: (editingEvent.city || "").trim() || null,
      category: (editingEvent.category || "").trim() || null,
      image_url: (editingEvent.image_url || "").trim() || null,
    };

    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", editingEvent.id)
      .select("*")
      .single();

    setLoading(false);

    if (error) {
      console.error("[admin/events] updateEvent error:", error);
      alert(`No se pudo actualizar (RLS/columna/id): ${error.message}`);
      return;
    }

    setEditingEvent(null);
    await fetchEvents();

    alert(`Evento actualizado ✅ (${data?.title || "OK"})`);
  };

  const deleteEvent = async (id) => {
    const ev = events.find((x) => x.id === id);
    const name = ev?.title || "este evento";

    if (!confirm(`¿Seguro que quieres eliminar "${name}" y todas sus entradas?`)) return;

    setLoading(true);

    const { error: tErr } = await supabase.from("tickets").delete().eq("event_id", id);
    if (tErr) console.warn("[admin/events] delete tickets warning:", tErr);

    const { error } = await supabase.from("events").delete().eq("id", id);

    setLoading(false);

    if (error) {
      console.error("[admin/events] deleteEvent error:", error);
      alert(`Error al eliminar evento: ${error.message}`);
      return;
    }

    await fetchEvents();
    alert("Evento eliminado ✅");
  };

  /** ============ IMPORT MASIVO (Excel/CSV) ============ */

  function downloadTemplate() {
    const csv =
      [
        "title,starts_at,venue,city,category,image_url",
        'Bad Bunny - World Tour,2026-03-12 21:00,Estadio Nacional,Santiago,Conciertos,https://link-a-una-imagen.jpg',
        'Metallica,12/04/2026 20:30,Movistar Arena,Santiago,Rock,https://link-a-una-imagen.jpg',
      ].join("\n") + "\n";

    downloadCsv("tixswap_events_template.csv", csv);
  }

  function parseDateStringToIso(value) {
    const v = (value || "").toString().trim();
    if (!v) return null;

    // ISO directo o parecido
    // 2026-03-12T21:00 o 2026-03-12 21:00
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const isoLike = v.includes("T") ? v : v.replace(" ", "T");
      const d = new Date(isoLike);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }

    // dd/mm/yyyy hh:mm (o sin hora)
    const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const yyyy = parseInt(m[3], 10);
      const hh = m[4] ? parseInt(m[4], 10) : 21; // default 21:00 si no viene
      const mi = m[5] ? parseInt(m[5], 10) : 0;
      const d = new Date(yyyy, mm - 1, dd, hh, mi, 0);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }

    // fallback: a ver si Date lo entiende
    const d2 = new Date(v);
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();

    return null;
  }

  async function handleImportFile(file) {
    if (!file) return;

    setImportPreview(null);
    setImporting(true);

    try {
      // Carga dinámica pa no inflar el bundle
      const XLSX = await import("xlsx");

      const filename = file.name || "archivo";
      const ext = filename.toLowerCase().split(".").pop();

      let workbook;
      if (ext === "csv") {
        const text = await file.text();
        workbook = XLSX.read(text, { type: "string", cellDates: true });
      } else {
        const buf = await file.arrayBuffer();
        workbook = XLSX.read(buf, { type: "array", cellDates: true });
      }

      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new Error("No pude encontrar hojas en el archivo.");

      const ws = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error("El archivo viene vacío o sin filas.");
      }

      // Mapa de headers aceptados (normalizados)
      const headerSynonyms = {
        title: ["title", "titulo", "título", "evento", "nombre"],
        starts_at: ["starts_at", "fecha", "fecha_hora", "fecha hora", "inicio", "date", "fecha y hora"],
        venue: ["venue", "ubicacion", "ubicación", "recinto", "lugar", "location"],
        city: ["city", "ciudad"],
        category: ["category", "categoria", "categoría"],
        image_url: ["image_url", "url_imagen", "url imagen", "imagen", "foto", "image", "url de imagen"],
      };

      const existingKeys = new Set(
        (events || []).map((ev) => makeEventKey(ev?.title || "", ev?.starts_at))
      );
      const seenInFile = new Set();

      const validPayloads = [];
      const invalidRows = [];
      const duplicateRows = [];

      rawRows.forEach((row, idx) => {
        const rowIndex = idx + 2; // aprox: header=1, data=2... (para que te calce con Excel)

        // normaliza keys del row
        const rowN = {};
        Object.entries(row || {}).forEach(([k, v]) => {
          rowN[norm(k)] = v;
        });

        const pick = (field) => {
          const opts = headerSynonyms[field] || [];
          for (const o of opts) {
            const key = norm(o);
            if (rowN[key] !== undefined) return rowN[key];
          }
          return "";
        };

        const title = (pick("title") || "").toString().trim();
        const venue = (pick("venue") || "").toString().trim();

        // starts_at puede venir Date (xlsx), número (serial) o string
        let startsIso = null;
        const startsVal = pick("starts_at");

        if (startsVal instanceof Date) {
          startsIso = new Date(startsVal).toISOString();
        } else if (typeof startsVal === "number") {
          // Excel serial
          const dc = XLSX.SSF.parse_date_code(startsVal);
          if (dc && dc.y && dc.m && dc.d) {
            const d = new Date(dc.y, dc.m - 1, dc.d, dc.H || 0, dc.M || 0, Math.floor(dc.S || 0));
            if (!Number.isNaN(d.getTime())) startsIso = d.toISOString();
          }
        } else {
          startsIso = parseDateStringToIso(startsVal);
        }

        const city = (pick("city") || "").toString().trim();
        const category = (pick("category") || "").toString().trim();
        const image_url = (pick("image_url") || "").toString().trim();

        if (!title || !venue || !startsIso) {
          const missing = [
            !title ? "title" : null,
            !startsIso ? "starts_at" : null,
            !venue ? "venue" : null,
          ].filter(Boolean);

          invalidRows.push({
            rowIndex,
            reason: `Faltan obligatorios: ${missing.join(", ")} (title / starts_at / venue)`,
          });
          return;
        }

        const payload = {
          title,
          starts_at: startsIso,
          venue,
          city: city || null,
          category: category || null,
          image_url: image_url || null,
        };

        const key = makeEventKey(payload.title, payload.starts_at);

        // Duplicados dentro del mismo archivo
        if (seenInFile.has(key)) {
          duplicateRows.push({ rowIndex, reason: "Duplicado dentro del mismo archivo" });
          return;
        }
        seenInFile.add(key);

        // Duplicados vs BD actual (si skipDuplicates está activo, después los filtramos)
        if (existingKeys.has(key)) {
          duplicateRows.push({ rowIndex, reason: "Ya existe en la BD (mismo título + fecha aprox.)" });
          validPayloads.push({ payload, rowIndex, key, existsInDb: true });
          return;
        }

        validPayloads.push({ payload, rowIndex, key, existsInDb: false });
      });

      setImportPreview({
        filename,
        totalRows: rawRows.length,
        validPayloads,
        invalidRows,
        duplicateRows,
      });
    } catch (err) {
      console.error("[admin/events] import parse error:", err);
      alert(`No pude leer el archivo: ${err?.message || "error"}`);
    } finally {
      setImporting(false);
    }
  }

  async function runImport() {
    if (!importPreview?.validPayloads?.length) return;

    const candidates = importPreview.validPayloads
      .filter((x) => (skipDuplicates ? !x.existsInDb : true))
      .map((x) => x);

    if (!candidates.length) {
      alert("No hay filas nuevas para importar (todo ya existe / duplicado).");
      return;
    }

    if (
      !confirm(
        `Vas a importar ${candidates.length} evento(s). ${
          skipDuplicates ? "Omitiendo los que ya existen." : "Incluyendo posibles duplicados."
        }\n\n¿Dale?`
      )
    ) {
      return;
    }

    setImporting(true);

    let ok = 0;
    const failed = [];

    // Inserta en bloques, y si un bloque falla, baja a uno-a-uno para aislar el problema
    const chunkSize = 50;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      const payloads = chunk.map((x) => x.payload);

      const { error } = await supabase.from("events").insert(payloads);

      if (!error) {
        ok += chunk.length;
        continue;
      }

      console.warn("[admin/events] bulk insert chunk failed, fallback row-by-row:", error);

      for (const item of chunk) {
        const { error: e2 } = await supabase.from("events").insert([item.payload]);
        if (!e2) {
          ok += 1;
        } else {
          failed.push({ rowIndex: item.rowIndex, reason: e2.message });
        }
      }
    }

    setImporting(false);

    await fetchEvents();

    if (failed.length) {
      const top = failed.slice(0, 8).map((f) => `Fila ${f.rowIndex}: ${f.reason}`).join("\n");
      alert(`Importación parcial ✅\n\nOK: ${ok}\nFallidas: ${failed.length}\n\nPrimeros errores:\n${top}`);
    } else {
      alert(`Importación lista ✅\n\nOK: ${ok}`);
    }

    setImportPreview(null);
  }

  if (checkingAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Validando permisos de administrador...
        </div>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Panel de eventos</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      {/* IMPORT MASIVO */}
      <div className="bg-white p-5 rounded-2xl shadow mb-10 border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Importar eventos (Excel/CSV)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sube un <b>.xlsx</b> o <b>.csv</b> con columnas: <code>title</code>, <code>starts_at</code>, <code>venue</code>{" "}
              (obligatorias) y opcionales: <code>city</code>, <code>category</code>, <code>image_url</code>.
              <br />
              <span className="text-gray-400">
                Formatos aceptados para <code>starts_at</code>: <i>2026-03-12 21:00</i> o <i>12/03/2026 21:00</i> o celda de fecha de Excel.
              </span>
            </p>
          </div>

          <button
            onClick={downloadTemplate}
            className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
          >
            Descargar plantilla CSV
          </button>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={importing}
            onChange={(e) => handleImportFile(e.target.files?.[0])}
            className="block w-full md:max-w-md text-sm"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
            />
            Omitir los que ya existen (recomendado)
          </label>

          {importing ? (
            <span className="text-sm text-gray-500">Procesando archivo...</span>
          ) : null}
        </div>

        {importPreview ? (
          <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm">
                <div>
                  Archivo: <b>{importPreview.filename}</b>
                </div>
                <div className="mt-1">
                  Filas detectadas: <b>{importPreview.totalRows}</b> · Válidas:{" "}
                  <b>{importPreview.validPayloads.length}</b> · Inválidas:{" "}
                  <b>{importPreview.invalidRows.length}</b> · Duplicadas:{" "}
                  <b>{importPreview.duplicateRows.length}</b>
                </div>
              </div>

              <button
                onClick={runImport}
                disabled={importing}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Importar ahora
              </button>
            </div>

            {/* Preview de errores */}
            {(importPreview.invalidRows.length > 0 || importPreview.duplicateRows.length > 0) ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-white border p-3">
                  <div className="font-semibold text-sm mb-2">Inválidas (primeras 6)</div>
                  {importPreview.invalidRows.slice(0, 6).map((r) => (
                    <div key={`inv-${r.rowIndex}`} className="text-sm text-gray-700">
                      <b>Fila {r.rowIndex}:</b> {r.reason}
                    </div>
                  ))}
                  {importPreview.invalidRows.length > 6 ? (
                    <div className="text-xs text-gray-400 mt-2">
                      ...y {importPreview.invalidRows.length - 6} más
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl bg-white border p-3">
                  <div className="font-semibold text-sm mb-2">Duplicadas (primeras 6)</div>
                  {importPreview.duplicateRows.slice(0, 6).map((r) => (
                    <div key={`dup-${r.rowIndex}`} className="text-sm text-gray-700">
                      <b>Fila {r.rowIndex}:</b> {r.reason}
                    </div>
                  ))}
                  {importPreview.duplicateRows.length > 6 ? (
                    <div className="text-xs text-gray-400 mt-2">
                      ...y {importPreview.duplicateRows.length - 6} más
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-green-700">
                Se ve limpio ✅ No hay errores ni duplicados detectados.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Crear nuevo evento */}
      <div className="bg-white p-5 rounded-2xl shadow mb-10">
        <h2 className="text-xl font-semibold mb-4">Crear nuevo evento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border p-2 rounded-xl"
            placeholder="Título del evento"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
          />

          <input
            type="datetime-local"
            className="border p-2 rounded-xl"
            value={newEvent.starts_at}
            onChange={(e) => setNewEvent({ ...newEvent, starts_at: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Ubicación (recinto)"
            value={newEvent.venue}
            onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Ciudad (opcional)"
            value={newEvent.city}
            onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="Categoría (opcional)"
            value={newEvent.category}
            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
          />

          <input
            className="border p-2 rounded-xl"
            placeholder="URL de imagen (opcional)"
            value={newEvent.image_url}
            onChange={(e) => setNewEvent({ ...newEvent, image_url: e.target.value })}
          />
        </div>

        {/* Preview create */}
        <div className="mt-4 w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
          {newEvent.image_url ? (
            <img src={newEvent.image_url} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm text-slate-400">Falta cargar imagen</span>
          )}
        </div>

        <button
          onClick={createEvent}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear evento"}
        </button>
      </div>

      {/* Buscador */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-2xl font-semibold">Eventos en backend</h2>
        <input
          className="border rounded-xl px-4 py-2 w-full max-w-sm"
          placeholder="Buscar evento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((ev) => {
          const title = ev?.title || "Evento";
          const venue = ev?.venue || ev?.location || "";
          const city = ev?.city || "";
          const imageUrl = ev?.image_url || "";

          return (
            <div key={ev.id} className="bg-white shadow rounded-xl p-4 relative">
              {editingEvent?.id === ev.id ? (
                <>
                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    type="datetime-local"
                    value={editingEvent.starts_at}
                    onChange={(e) => setEditingEvent({ ...editingEvent, starts_at: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="Ubicación (recinto)"
                    value={editingEvent.venue}
                    onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="Ciudad (opcional)"
                    value={editingEvent.city}
                    onChange={(e) => setEditingEvent({ ...editingEvent, city: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="Categoría (opcional)"
                    value={editingEvent.category}
                    onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
                  />

                  <input
                    className="border p-2 w-full mb-2 rounded-xl"
                    placeholder="URL de imagen (opcional)"
                    value={editingEvent.image_url}
                    onChange={(e) => setEditingEvent({ ...editingEvent, image_url: e.target.value })}
                  />

                  {/* Preview edit */}
                  <div className="mb-3 w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                    {editingEvent.image_url ? (
                      <img
                        src={editingEvent.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-sm text-slate-400">Falta cargar imagen</span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={updateEvent}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-60"
                    >
                      {loading ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditingEvent(null)}
                      disabled={loading}
                      className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Imagen */}
                  <div className="mb-3 w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm text-slate-400">Falta cargar imagen</span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-gray-500">{ev?.starts_at ? formatEventDate(ev.starts_at) : "(Sin fecha)"}</p>
                  <p className="text-sm">
                    {venue || "—"}
                    {venue && city ? " — " : ""}
                    {city || ""}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Categoría: {ev?.category || "—"}</p>

                  <div className="flex justify-end gap-3 mt-3">
                    <button onClick={() => startEdit(ev)} className="text-blue-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => deleteEvent(ev.id)} className="text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
