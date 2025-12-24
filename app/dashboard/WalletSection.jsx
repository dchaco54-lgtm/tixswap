// app/dashboard/WalletSection.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ACCOUNT_TYPES = [
  { value: "corriente", label: "Cuenta corriente" },
  { value: "vista", label: "Cuenta vista" },
  { value: "rut", label: "CuentaRUT" },
  { value: "digital", label: "Cuenta digital / prepago" },
];

// Lista corta (sugerencias). Igual dejamos input libre.
const BANK_SUGGESTIONS = [
  "Banco de Chile",
  "Banco Estado",
  "Banco Santander",
  "BCI",
  "Scotiabank",
  "Banco Itaú",
  "Banco Falabella",
  "Banco Security",
  "Banco BICE",
  "Banco Consorcio",
  "Banco Internacional",
  "Ripley",
  "Copec Pay",
  "Mach",
  "Tenpo",
  "Mercado Pago",
  "Otro",
];

function normalizeRut(raw) {
  if (!raw) return "";
  return raw.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

function onlyDigits(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/[^0-9]/g, "");
}

export default function WalletSection({ user }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const metaName =
    user?.user_metadata?.name || user?.user_metadata?.full_name || "";
  const metaRut = user?.user_metadata?.rut || "";
  const metaPhone = user?.user_metadata?.phone || "";

  const [form, setForm] = useState({
    holder_name: "",
    holder_rut: "",
    bank_name: "",
    account_type: "corriente",
    account_number: "",
    transfer_email: "",
    transfer_phone: "",
  });

  const configured = useMemo(() => {
    return (
      !!form.holder_name.trim() &&
      !!form.holder_rut.trim() &&
      !!form.bank_name.trim() &&
      !!form.account_number.trim()
    );
  }, [form]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setLoadError("");

      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("payout_accounts")
        .select(
          "user_id, holder_name, holder_rut, bank_name, account_type, account_number, transfer_email, transfer_phone"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("relation") && msg.includes("does not exist")) {
          setLoadError(
            "Aún no existe la tabla payout_accounts en Supabase. Crea la tabla (te dejé el SQL) y vuelve a cargar."
          );
        } else {
          setLoadError("No pudimos cargar tu Wallet. Intenta de nuevo.");
        }

        setForm((prev) => ({
          ...prev,
          holder_name: metaName || prev.holder_name,
          holder_rut: metaRut || prev.holder_rut,
          transfer_phone: metaPhone || prev.transfer_phone,
        }));
        setLoading(false);
        return;
      }

      if (data) {
        setForm({
          holder_name: data.holder_name || metaName || "",
          holder_rut: data.holder_rut || metaRut || "",
          bank_name: data.bank_name || "",
          account_type: data.account_type || "corriente",
          account_number: data.account_number || "",
          transfer_email: data.transfer_email || user?.email || "",
          transfer_phone: data.transfer_phone || metaPhone || "",
        });
      } else {
        setForm({
          holder_name: metaName || "",
          holder_rut: metaRut || "",
          bank_name: "",
          account_type: "corriente",
          account_number: "",
          transfer_email: user?.email || "",
          transfer_phone: metaPhone || "",
        });
      }

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function onChange(field) {
    return (e) => {
      const value = e.target.value;
      setSaveError("");
      setSaveSuccess("");

      if (field === "holder_rut") {
        setForm((prev) => ({ ...prev, holder_rut: normalizeRut(value) }));
        return;
      }

      if (field === "account_number") {
        setForm((prev) => ({ ...prev, account_number: onlyDigits(value) }));
        return;
      }

      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    if (!user?.id) {
      setSaveError("Debes iniciar sesión.");
      return;
    }

    if (!form.holder_name.trim() || !form.holder_rut.trim()) {
      setSaveError("Completa el nombre y RUT del titular.");
      return;
    }
    if (!form.bank_name.trim()) {
      setSaveError("Selecciona o escribe tu banco/institución.");
      return;
    }
    if (!form.account_number.trim()) {
      setSaveError("Ingresa el número de cuenta.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        user_id: user.id,
        holder_name: form.holder_name.trim(),
        holder_rut: normalizeRut(form.holder_rut.trim()),
        bank_name: form.bank_name.trim(),
        account_type: form.account_type,
        account_number: form.account_number.trim(),
        transfer_email: form.transfer_email?.trim() || null,
        transfer_phone: form.transfer_phone?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("payout_accounts")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        setSaveError(`No se pudo guardar. ${error.message || "Intenta de nuevo."}`);
        return;
      }

      setSaveSuccess("Wallet guardada. Ya tenemos tus datos para pagarte.");
    } catch {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Wallet</h2>
            <p className="text-sm text-slate-500 mt-1">
              Aquí configuras los datos donde TixSwap te deposita tus ventas.
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              configured
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-amber-50 text-amber-700 border-amber-100"
            }`}
          >
            {configured ? "Configurado" : "Pendiente"}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold">Pagos (MVP)</p>
          <p className="mt-1">
            TixSwap deposita a vendedores los días <b>lunes, miércoles y viernes</b>,
            solo si la compra está aprobada o si pasaron <b>48h después del evento</b>
            sin reclamos.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
        <h3 className="text-base font-semibold">Datos para transferencia</h3>
        <p className="text-sm text-slate-500 mt-1">
          Puedes usar cuenta corriente, vista, CuentaRUT o cuenta digital (Tenpo/Mach, etc.).
        </p>

        {loading ? (
          <div className="mt-6 text-sm text-slate-600">Cargando Wallet…</div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 grid gap-4">
            {loadError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {loadError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre titular
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.holder_name}
                  onChange={onChange("holder_name")}
                  placeholder="Ej: David Chacón"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RUT titular
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.holder_rut}
                  onChange={onChange("holder_rut")}
                  placeholder="12.345.678-9"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Tip: lo guardamos tal cual (sin puntos también sirve).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Banco / institución
                </label>
                <input
                  list="banks"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.bank_name}
                  onChange={onChange("bank_name")}
                  placeholder="Ej: Banco de Chile, Tenpo, Mach"
                />
                <datalist id="banks">
                  {BANK_SUGGESTIONS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de cuenta
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.account_type}
                  onChange={onChange("account_type")}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número de cuenta
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.account_number}
                  onChange={onChange("account_number")}
                  placeholder="Solo números"
                  inputMode="numeric"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Para CuentaRUT normalmente es tu RUT sin DV (pero puedes pegar lo que uses, solo guardamos dígitos).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email (opcional)
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.transfer_email}
                  onChange={onChange("transfer_email")}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.transfer_phone}
                  onChange={onChange("transfer_phone")}
                  placeholder="+56 9 1234 5678"
                />
              </div>

              <div className="hidden md:block" />
            </div>

            {saveError ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {saveError}
              </p>
            ) : null}

            {saveSuccess ? (
              <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {saveSuccess}
              </p>
            ) : null}

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Guardar Wallet"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
