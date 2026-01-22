// app/dashboard/WalletSection.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const ACCOUNT_TYPES = [
  "Cuenta corriente",
  "Cuenta vista",
  "CuentaRUT",
  "Cuenta digital (Mach/Tenpo/otro)",
];

export default function WalletSection({ user: userProp = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [configured, setConfigured] = useState(false);
  const [editing, setEditing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [authedUser, setAuthedUser] = useState(userProp);
  const [profile, setProfile] = useState(null);

  const [form, setForm] = useState({
    bank_name: "",
    account_type: "Cuenta corriente",
    account_number: "",
    transfer_email: "",
    transfer_phone: "",
  });

  const [savedView, setSavedView] = useState(null); // payout_accounts row

  // Si el padre algún día pasa user, lo respetamos
  useEffect(() => {
    if (userProp?.id) setAuthedUser(userProp);
  }, [userProp]);

  const holderName = useMemo(() => {
    const fromProfile = (profile?.full_name || "").trim();
    if (fromProfile) return fromProfile;

    const meta =
      authedUser?.user_metadata?.name ||
      authedUser?.user_metadata?.full_name ||
      authedUser?.user_metadata?.fullName ||
      "";

    return String(meta || "").trim();
  }, [profile?.full_name, authedUser]);

  const holderRut = useMemo(() => {
    const fromProfile = String(profile?.rut || "").trim();
    if (fromProfile) return fromProfile;

    return String(authedUser?.user_metadata?.rut || "").trim();
  }, [profile?.rut, authedUser]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        // 1) user
        let u = authedUser;

        if (!u) {
          const { data } = await supabase.auth.getUser();
          u = data?.user || null;
          setAuthedUser(u);
        }

        if (!u) {
          setError("Debes iniciar sesión.");
          setConfigured(false);
          setSavedView(null);
          setEditing(false);
          return;
        }

        // 2) profile (FUENTE REAL pa nombre/rut)
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, full_name, rut, email, phone, role")
          .eq("id", u.id)
          .maybeSingle();

        setProfile(pData || null);

        // 3) wallet
        const { data: wData, error: wErr } = await supabase
          .from("payout_accounts")
          .select("*")
          .eq("user_id", u.id)
          .maybeSingle();

        if (wErr) {
          console.warn(wErr);
          setConfigured(false);
          setSavedView(null);
          setEditing(true);
          return;
        }

        if (wData) {
          setConfigured(true);
          setSavedView(wData);
          setForm({
            bank_name: wData.bank_name || "",
            account_type: wData.account_type || "Cuenta corriente",
            account_number: wData.account_number || "",
            transfer_email: wData.transfer_email || "",
            transfer_phone: wData.transfer_phone || "",
          });
          setEditing(false);
        } else {
          setConfigured(false);
          setSavedView(null);
          setEditing(true); // si no hay wallet, entra en modo editar
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (k) => (e) => {
    setError("");
    setSuccess("");
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };

  const handleEdit = () => {
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setError("");
    setSuccess("");
    if (savedView) {
      setForm({
        bank_name: savedView.bank_name || "",
        account_type: savedView.account_type || "Cuenta corriente",
        account_number: savedView.account_number || "",
        transfer_email: savedView.transfer_email || "",
        transfer_phone: savedView.transfer_phone || "",
      });
      setEditing(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!authedUser?.id) {
      setError("Debes iniciar sesión.");
      return;
    }

    // Importante: nombre/rut deben existir desde cuenta/perfil
    if (!holderName || !holderRut) {
      setError(
        "No encontré tu Nombre/RUT en tu cuenta. Revisa 'Mis datos' (nombre y RUT) o solicita cambio por ticket."
      );
      return;
    }

    if (!form.bank_name.trim() || !form.account_type.trim() || !form.account_number.trim()) {
      setError("Completa Banco, Tipo de cuenta y Número de cuenta.");
      return;
    }

    try {
      setSaving(true);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      if (!token) {
        setError("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch("/api/wallet/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_name: form.bank_name,
          account_type: form.account_type,
          account_number: form.account_number,
          transfer_email: form.transfer_email,
          transfer_phone: form.transfer_phone,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || json?.details || "No se pudo guardar Wallet.");
        return;
      }

      setConfigured(true);
      setSavedView(json?.payout_account || null);
      setEditing(false);
      setSuccess("Wallet guardada. Ya tenemos tus datos para pagarte.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
        <h2 className="text-lg font-semibold mb-2">Wallet</h2>
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón de retorno si viene desde /sell/confirm */}
      {returnUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-blue-900">
                Configura tu Wallet para continuar publicando tu ticket
              </p>
            </div>
            <button
              onClick={() => router.push(returnUrl)}
              className="tix-btn-primary text-sm px-4 py-2"
            >
              Volver a la venta
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Wallet</h2>
            <p className="text-sm text-slate-500">
              Aquí configuras los datos donde TixSwap te deposita tus ventas.
            </p>
          </div>

          {configured && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              Configurado
            </span>
          )}
        </div>

        <div className="mt-4 border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-1">Pagos (MVP)</p>
          <p className="text-sm text-slate-600">
            TixSwap deposita a vendedores los días{" "}
            <span className="font-semibold">lunes, miércoles y viernes</span>, solo si la compra está aprobada
            o si pasaron <span className="font-semibold">48h después del evento, sin reclamos</span>.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Datos para transferencia</h3>
            <p className="text-sm text-slate-500">
              Puedes usar cuenta corriente, vista, CuentaRUT o cuenta digital (Tenpo/Mach, etc.).
            </p>
          </div>

          {configured && !editing && (
            <button
              type="button"
              onClick={handleEdit}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Editar
            </button>
          )}
        </div>

        {/* Bloque anti-estafa (nombre/rut desde cuenta) */}
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre titular</label>
            <input
              value={holderName || ""}
              readOnly
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
              placeholder="(se toma desde tu cuenta)"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Por seguridad, este dato viene desde tu cuenta y no se puede cambiar aquí.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">RUT titular</label>
            <input
              value={holderRut || ""}
              readOnly
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
              placeholder="(se toma desde tu cuenta)"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Tip: lo guardamos tal cual (sin puntos también sirve).
            </p>
          </div>
        </div>

        {/* Form editable solo si editing */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Banco / institución</label>
            <input
              value={form.bank_name}
              onChange={setField("bank_name")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing
                  ? "border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              placeholder="Banco de Chile / Santander / Tenpo..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de cuenta</label>
            <select
              value={form.account_type}
              onChange={setField("account_type")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing
                  ? "border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {ACCOUNT_TYPES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Número de cuenta</label>
            <input
              value={form.account_number}
              onChange={setField("account_number")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing
                  ? "border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              placeholder="Para CuentaRUT normalmente es tu RUT sin DV (pero puedes pegar lo que uses)."
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Para CuentaRUT normalmente es tu RUT sin DV (pero puedes pegar lo que uses).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email (opcional)</label>
            <input
              value={form.transfer_email}
              onChange={setField("transfer_email")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing
                  ? "border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              placeholder="correo@ejemplo.cl"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (opcional)</label>
            <input
              value={form.transfer_phone}
              onChange={setField("transfer_phone")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing
                  ? "border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              placeholder="+56 9 ..."
            />
          </div>
        </div>

        {/* Alerts + actions */}
        <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {success}
              </div>
            )}
          </div>

          {editing ? (
            <div className="flex gap-2 justify-end">
              {configured && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                  disabled={saving}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : configured ? "Guardar cambios" : "Guardar Wallet"}
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Wallet configurada. Si necesitas cambiar tus datos bancarios, usa “Editar”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

