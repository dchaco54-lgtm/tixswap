"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ACCOUNT_TYPES = [
  "Cuenta corriente",
  "Cuenta vista",
  "CuentaRUT",
  "Cuenta digital (Mach/Tenpo/otro)",
];

function maskAccount(n) {
  const s = String(n || "").trim();
  if (s.length <= 4) return s;
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export default function WalletSection({ user: userProp = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return");
  const supabaseRef = useRef(null);
  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  };

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

  const [savedView, setSavedView] = useState(null);

  // si el padre pasa user, lo tomamos
  useEffect(() => {
    if (userProp?.id) setAuthedUser(userProp);
  }, [userProp]);

  const holderName = useMemo(() => {
    const fromProfile = String(profile?.full_name || "").trim();
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

  const setField = (k) => (e) => {
    setError("");
    setSuccess("");
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };

  const loadWallet = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const supabase = getSupabase();

    try {
      // 1) user
      let u = authedUser;
      if (!u) {
        const { data } = await supabase.auth.getUser();
        u = data?.user || null;
        setAuthedUser(u);
      }

      if (!u) {
        router.push(`/login?redirectTo=${encodeURIComponent("/dashboard/wallet")}`);
        return;
      }

      // 2) profile (solo lo esencial, para no romperse si tu tabla es “minimal”)
      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, rut")
        .eq("id", u.id)
        .maybeSingle();

      if (!pErr) setProfile(pData || null);

      // 3) payout_accounts
      const { data: wData, error: wErr } = await supabase
        .from("payout_accounts")
        .select("user_id, holder_name, holder_rut, bank_name, account_type, account_number, transfer_email, transfer_phone, created_at, updated_at")
        .eq("user_id", u.id)
        .maybeSingle();

      if (wErr) {
        // si hay error, dejamos editable para que el usuario no quede bloqueado
        console.warn("wallet load error:", wErr);
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
        setEditing(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const supabase = getSupabase();

    if (!authedUser?.id) {
      setError("Debes iniciar sesión.");
      router.push(`/login?redirectTo=${encodeURIComponent("/dashboard/wallet")}`);
      return;
    }

    // Nombre/RUT desde cuenta/perfil (no editable acá por seguridad)
    if (!holderName || !holderRut) {
      setError("No encontré tu Nombre/RUT. Ve a “Mis datos” o solicita cambio por soporte.");
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
        router.push(`/login?redirectTo=${encodeURIComponent("/dashboard/wallet")}`);
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
      setSuccess("Wallet guardada ✅ Ya tenemos tus datos para pagarte.");
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
      {/* Banner retorno */}
      {returnUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-blue-900">
              Configura tu Wallet para continuar publicando tu ticket.
            </p>
            <button onClick={() => router.push(returnUrl)} className="tix-btn-primary text-sm px-4 py-2">
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
              Configura la cuenta donde TixSwap te deposita tus ventas.
            </p>
          </div>

          {configured && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              Configurado
            </span>
          )}
        </div>

        {/* Resumen si está configurada */}
        {configured && savedView ? (
          <div className="mt-4 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-1">Resumen</p>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{savedView.bank_name}</span> · {savedView.account_type} ·{" "}
              <span className="font-mono">{maskAccount(savedView.account_number)}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Última actualización:{" "}
              {savedView.updated_at ? new Date(savedView.updated_at).toLocaleString("es-CL") : "—"}
            </p>
          </div>
        ) : null}

        <div className="mt-4 border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-1">Pagos (MVP)</p>
          <p className="text-sm text-slate-600">
            TixSwap deposita a vendedores los días{" "}
            <span className="font-semibold">lunes, miércoles y viernes</span>, solo si la compra está aprobada
            o si pasaron <span className="font-semibold">48h después del evento, sin reclamos</span>.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Datos para transferencia</h3>
            <p className="text-sm text-slate-500">
              Cuenta corriente/vista/CuentaRUT o cuenta digital (Tenpo/Mach, etc.).
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

        {/* Titular (readonly) */}
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
              Por seguridad, esto viene desde tu cuenta (no se edita acá).
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
              Si está malo, corrígelo en “Mis datos” o solicita cambio por soporte.
            </p>
          </div>
        </div>

        {/* Editables */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Banco / institución</label>
            <input
              value={form.bank_name}
              onChange={setField("bank_name")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing ? "border-slate-300 focus:ring-2 focus:ring-blue-500" : "border-slate-200 bg-slate-50 text-slate-600"
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
                editing ? "border-slate-300 focus:ring-2 focus:ring-blue-500" : "border-slate-200 bg-slate-50 text-slate-600"
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
              inputMode="text"
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing ? "border-slate-300 focus:ring-2 focus:ring-blue-500" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              placeholder="Ej: CuentaRUT suele ser RUT sin DV (pero pega lo que uses)."
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Tip: si es CuentaRUT, muchas veces es tu RUT sin DV.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email (opcional)</label>
            <input
              value={form.transfer_email}
              onChange={setField("transfer_email")}
              disabled={!editing}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                editing ? "border-slate-300 focus:ring-2 focus:ring-blue-500" : "border-slate-200 bg-slate-50 text-slate-600"
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
                editing ? "border-slate-300 focus:ring-2 focus:ring-blue-500" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              placeholder="+56 9 ..."
            />
          </div>
        </div>

        {/* alerts + actions */}
        <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1">
            {error ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {success}
              </div>
            ) : null}
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
