"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import WalletSection from "./WalletSection";

function roleLabel(role) {
  if (role === "admin") return "Administrador";
  if (role === "seller") return "Vendedor";
  return "Usuario";
}

function buildPrefillTicket({ field, currentValue }) {
  const base = {
    category: "soporte",
    subject: "",
    message: "",
  };

  if (field === "name") {
    base.subject = "Solicitud de cambio de Nombre";
    base.message = `Hola soporte 👋\n\nQuiero solicitar cambio de mi NOMBRE.\n\nNombre actual: ${currentValue || "—"}\nNombre nuevo: (escríbelo acá)\n\nMotivo / respaldo: (opcional)\n`;
    return base;
  }

  if (field === "rut") {
    base.subject = "Solicitud de cambio de RUT";
    base.message = `Hola soporte 👋\n\nQuiero solicitar cambio de mi RUT.\n\nRUT actual: ${currentValue || "—"}\nRUT nuevo: (escríbelo acá)\n\nAdjunto foto/validación si corresponde.\n`;
    return base;
  }

  base.subject = "Solicitud a soporte";
  base.message = "Hola soporte 👋\n\n";
  return base;
}

export default function DashboardPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState(sp.get("tab") || "mis_datos");

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [editing, setEditing] = useState(false);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const init = async () => {
      setBooting(true);
      setErr("");
      setMsg("");

      const {
        data: { user: u },
      } = await supabase.auth.getUser();

      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, rut, email, phone, role")
        .eq("id", u.id)
        .maybeSingle();

      if (pErr) setErr(pErr.message);
      setProfile(p || null);

      setDraftEmail((p?.email || u.email || "").trim());
      setDraftPhone((p?.phone || "").trim());

      setBooting(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // sync tab con url (opcional y simple)
    const urlTab = sp.get("tab");
    if (urlTab && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const navItems = useMemo(() => {
    const isAdmin = profile?.role === "admin";
    return [
      { id: "resumen", label: "Resumen" },
      { id: "mis_datos", label: "Mis datos" },
      { id: "mis_ventas", label: "Mis ventas" },
      { id: "mis_compras", label: "Mis compras" },
      { id: "mis_calificaciones", label: "Mis calificaciones" },
      { id: "wallet", label: "Wallet" },
      { id: "soporte", label: "Soporte", href: "/dashboard/soporte" },
      { id: "tickets", label: "Mis tickets", href: "/dashboard/tickets" },
      ...(isAdmin ? [{ id: "admin", label: "Admin", href: "/admin/events" }] : []),
    ];
  }, [profile?.role]);

  const goTab = (id, href) => {
    setMsg("");
    setErr("");
    setEditing(false);

    if (href) {
      router.push(href);
      return;
    }

    setTab(id);
    router.replace(`/dashboard?tab=${encodeURIComponent(id)}`);
  };

  const requestChangeTicket = (field) => {
    const currentValue =
      field === "name" ? profile?.full_name : field === "rut" ? profile?.rut : "";
    const t = buildPrefillTicket({ field, currentValue });

    const qs = new URLSearchParams({
      new: "1",
      category: t.category,
      subject: t.subject,
      message: t.message,
    });

    router.push(`/dashboard/soporte?${qs.toString()}`);
  };

  const startEdit = () => {
    setMsg("");
    setErr("");
    setDraftEmail((profile?.email || user?.email || "").trim());
    setDraftPhone((profile?.phone || "").trim());
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftEmail((profile?.email || user?.email || "").trim());
    setDraftPhone((profile?.phone || "").trim());
  };

  const saveProfile = async () => {
    setSaving(true);
    setMsg("");
    setErr("");

    try {
      const email = String(draftEmail || "").trim();
      const phone = String(draftPhone || "").trim();

      if (!email) throw new Error("El correo no puede estar vacío.");

      // 1) actualizar tabla profiles
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ email, phone })
        .eq("id", user.id);

      if (upErr) throw upErr;

      // 2) si cambió email, actualizar auth (puede requerir confirmación)
      if ((user?.email || "").trim().toLowerCase() !== email.toLowerCase()) {
        const { error: aErr } = await supabase.auth.updateUser({ email });
        if (aErr) throw aErr;

        setMsg(
          "Listo ✅ Te mandamos un correo para confirmar el cambio de email (si tu Supabase lo exige)."
        );
      } else {
        setMsg("Datos actualizados ✅");
      }

      // refresh profile
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, rut, email, phone, role")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(p || null);
      setEditing(false);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#f4f7ff]">
        <div className="tix-container py-10">
          <div className="tix-card p-6">
            <p className="text-slate-600">Cargando dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7ff]">
      <div className="tix-container py-10">
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

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* SIDEBAR */}
          <div className="tix-card p-4">
            <div className="text-sm font-extrabold text-slate-900 px-2">
              Panel
            </div>
            <div className="mt-3 space-y-1">
              {navItems.map((it) => {
                const active = it.href ? false : tab === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => goTab(it.id, it.href)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTENT */}
          <div className="space-y-6">
            {tab === "mis_datos" && (
              <div className="tix-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                      Mis datos
                    </h1>
                    <p className="text-slate-600 mt-1">
                      Puedes editar solo <b>correo</b> y <b>teléfono</b>. Para
                      cambiar <b>nombre</b> o <b>RUT</b>, se solicita por ticket.
                    </p>
                  </div>

                  {!editing ? (
                    <button onClick={startEdit} className="tix-btn-primary">
                      Editar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="tix-btn-primary"
                      >
                        {saving ? "Guardando…" : "Guardar"}
                      </button>
                      <button onClick={cancelEdit} className="tix-btn-ghost">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* LISTADO PRO */}
                <div className="mt-6 rounded-2xl border border-slate-100 bg-white">
                  <div className="divide-y divide-slate-100">
                    {/* Nombre */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">
                          Nombre (bloqueado)
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 mt-1">
                          {profile?.full_name || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => requestChangeTicket("name")}
                        className="tix-btn-ghost"
                        title="Crear ticket prellenado"
                      >
                        Solicitar cambio
                      </button>
                    </div>

                    {/* Email */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">
                          Correo
                        </div>

                        {!editing ? (
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.email || user?.email || "—"}
                          </div>
                        ) : (
                          <input
                            className="tix-input mt-2"
                            value={draftEmail}
                            onChange={(e) => setDraftEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                          />
                        )}
                      </div>
                    </div>

                    {/* RUT */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">
                          RUT (bloqueado)
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 mt-1">
                          {profile?.rut || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => requestChangeTicket("rut")}
                        className="tix-btn-ghost"
                        title="Crear ticket prellenado"
                      >
                        Solicitar cambio
                      </button>
                    </div>

                    {/* Teléfono */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">
                          Teléfono
                        </div>

                        {!editing ? (
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.phone || "—"}
                          </div>
                        ) : (
                          <input
                            className="tix-input mt-2"
                            value={draftPhone}
                            onChange={(e) => setDraftPhone(e.target.value)}
                            placeholder="+569..."
                          />
                        )}
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">
                          Categoría de usuario
                        </div>
                        <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold">
                          {roleLabel(profile?.role)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "wallet" && (
              <div className="tix-card p-6">
                <WalletSection />
              </div>
            )}

            {tab !== "mis_datos" && tab !== "wallet" && (
              <div className="tix-card p-6">
                <h2 className="text-xl font-extrabold text-slate-900">
                  {navItems.find((x) => x.id === tab)?.label || "Sección"}
                </h2>
                <p className="text-slate-600 mt-2">
                  Esta sección la dejamos lista pa’ después 😄
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


