"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminUploadsPage() {
  const router = useRouter();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setCheckingAdmin(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session?.user) {
          router.push("/login");
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type, app_role, email")
          .eq("id", user.id)
          .maybeSingle();

        const email = String(profile?.email || user.email || "").toLowerCase().trim();
        const isAdmin =
          String(profile?.user_type || "").toLowerCase() === "admin" ||
          String(profile?.app_role || "").toLowerCase() === "admin" ||
          email === "soporte@tixswap.cl";

        if (!isAdmin) {
          router.push("/dashboard");
          return;
        }

        if (!mounted) return;
        setAuthToken(session.access_token || "");
      } catch (bootError) {
        console.error("[admin/uploads] boot error:", bootError);
        router.push("/dashboard");
      } finally {
        if (mounted) setCheckingAdmin(false);
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authToken) return;
    let alive = true;

    async function loadRows() {
      try {
        setLoading(true);
        setError("");

        const url = new URL("/api/admin/uploads", window.location.origin);
        if (eventFilter.trim()) url.searchParams.set("event_id", eventFilter.trim());
        if (statusFilter.trim()) url.searchParams.set("status", statusFilter.trim());

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "No se pudo cargar uploads");
        }

        if (!alive) return;
        setRows(json?.uploads || []);
      } catch (loadError) {
        if (!alive) return;
        console.error("[admin/uploads] load error:", loadError);
        setRows([]);
        setError(loadError?.message || "No se pudo cargar uploads");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadRows();
    return () => {
      alive = false;
    };
  }, [authToken, eventFilter, statusFilter]);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const key = row?.status || "sin_estado";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { total: rows.length }
    );
  }, [rows]);

  if (checkingAdmin) {
    return (
      <main className="min-h-[100dvh] bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <p className="text-sm text-slate-500">Validando permisos admin...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Uploads PDF</h1>
            <p className="text-sm text-slate-500">
              Trazabilidad de staging/final por evento, usuario y ticket.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:text-slate-900 sm:w-auto"
          >
            ← Volver al admin
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_220px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="tix-input w-full"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                placeholder="Filtrar por event_id"
              />
              <select
                className="tix-input w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="staging">staging</option>
                <option value="finalized">finalized</option>
                <option value="orphaned">orphaned</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setEventFilter("");
                  setStatusFilter("");
                }}
                className="tix-btn-secondary w-full"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Resumen
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Total: <span className="font-semibold text-slate-900">{counts.total || 0}</span></div>
              <div>staging: <span className="font-semibold text-slate-900">{counts.staging || 0}</span></div>
              <div>finalized: <span className="font-semibold text-slate-900">{counts.finalized || 0}</span></div>
              <div>orphaned: <span className="font-semibold text-slate-900">{counts.orphaned || 0}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Cargando uploads...</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No hay uploads para esos filtros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Upload</th>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Archivo</th>
                    <th className="px-4 py-3">Creado</th>
                    <th className="px-4 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.event?.title || "Evento pendiente"}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {row.event_id || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.profile?.full_name || "Usuario"}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {row.profile?.email || row.user_id || row.seller_id || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="break-all font-mono text-xs text-slate-700">{row.id}</div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {row.effective_path || "Sin path"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="break-all text-slate-700">{row.ticket_id || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {row.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900">
                          {row.filename_original || row.original_name || "ticket.pdf"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {(row.mime_type || "application/pdf")} · {formatBytes(row.size_bytes || row.file_size)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {row.signed_url ? (
                          <a
                            href={row.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="tix-btn-primary inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm"
                          >
                            Abrir PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Sin URL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
