// app/admin/usuarios/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const ADMIN_EMAIL = "soporte@tixswap.cl";

const ROLE_OPTIONS = [
  { value: "free", label: "Free (fijado por admin)" },
  { value: "basic", label: "Básico" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
  { value: "elite", label: "Elite" },
];

function getCommissionForRole() {
  // Solo informativo en esta vista legacy; no toca pagos.
  return 0;
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  const [form, setForm] = useState({
    email: "",
    rut: "",
    role: "basic",
  });
  const [savingForm, setSavingForm] = useState(false);

  const [savingRowId, setSavingRowId] = useState(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        setErrorMsg("Supabase no está configurado (revisa las env vars).");
        setLoadingUser(false);
        return;
      }

      const { data, error } = await supabase.auth.getUser();

      const user = data?.user || null;

      if (error || !user) {
        router.push("/login");
        return;
      }

      // Solo el admin puede ver esta página
      if (user.email !== ADMIN_EMAIL) {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      setLoadingUser(false);
      fetchRows();
    };

    init();
  }, [router]);

  const fetchRows = async () => {
    setLoadingRows(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("email", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMsg("No pudimos cargar los roles. Intenta de nuevo.");
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoadingRows(false);
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSavingForm(true);

    const email = form.email.trim().toLowerCase();
    const rut = form.rut.trim();
    const role = form.role;
    const commission = getCommissionForRole(role);

    if (!email) {
      setErrorMsg("El correo es obligatorio.");
      setSavingForm(false);
      return;
    }

    const { error } = await supabase.from("user_roles").upsert(
      {
        email,
        rut: rut || null,
        role,
        commission_percent: commission,
      },
      {
        onConflict: "email",
      }
    );

    if (error) {
      console.error(error);
      setErrorMsg("No pudimos guardar el rol. Intenta de nuevo.");
    } else {
      setSuccessMsg("Rol guardado correctamente.");
      setForm({
        email: "",
        rut: "",
        role: "standard",
      });
      fetchRows();
    }

    setSavingForm(false);
  };

  const handleRowRoleChange = (id, newRole) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              role: newRole,
              commission_percent: getCommissionForRole(newRole),
            }
          : row
      )
    );
  };

  const handleRowRutChange = (id, newRut) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              rut: newRut,
            }
          : row
      )
    );
  };

  const handleSaveRow = async (row) => {
    setErrorMsg("");
    setSuccessMsg("");
    setSavingRowId(row.id);

    const { error } = await supabase
      .from("user_roles")
      .update({
        rut: row.rut || null,
        role: row.role,
        commission_percent: row.commission_percent,
      })
      .eq("id", row.id);

    if (error) {
      console.error(error);
      setErrorMsg("No pudimos actualizar el usuario. Intenta de nuevo.");
    } else {
      setSuccessMsg("Usuario actualizado correctamente.");
      fetchRows();
    }

    setSavingRowId(null);
  };

  if (loadingUser || !isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            Usuarios y roles · Admin
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Desde aquí puedes asignar rol <strong>Premium</strong> (2%) o{" "}
            <strong>Super Premium</strong> (0%) a los usuarios.
          </p>
        </div>

        {/* Mensajes */}
        {(errorMsg || successMsg) && (
          <div className="space-y-2">
            {errorMsg && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
                {successMsg}
              </div>
            )}
          </div>
        )}

        {/* Form crear / actualizar por correo */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Asignar rol a un usuario
          </h2>
          <p className="text-xs text-slate-500">
            Si el correo no existe en la tabla, se crea. Si ya existe, se
            actualiza el rol y la comisión.
          </p>

          <form
            onSubmit={handleCreateOrUpdate}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Correo electrónico *
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="usuario@correo.cl"
                value={form.email}
                onChange={handleFormChange("email")}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">RUT</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="11111111-1"
                value={form.rut}
                onChange={handleFormChange("rut")}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Rol / comisión
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={form.role}
                onChange={handleFormChange("role")}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={savingForm}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingForm ? "Guardando…" : "Guardar rol"}
              </button>
            </div>
          </form>
        </section>

        {/* Tabla de usuarios */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Usuarios con rol asignado
            </h2>
            {loadingRows && (
              <span className="text-xs text-slate-400">Cargando…</span>
            )}
          </div>

          {rows.length === 0 && !loadingRows ? (
            <p className="text-sm text-slate-500">
              Aún no hay usuarios con rol asignado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">
                      Correo
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">
                      RUT
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">
                      Rol
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">
                      Comisión
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 align-middle">
                        <span className="text-slate-900">{row.email}</span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="text"
                          className="w-full max-w-[160px] rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          value={row.rut || ""}
                          onChange={(e) =>
                            handleRowRutChange(row.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <select
                          className="w-full max-w-[210px] rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          value={row.role}
                          onChange={(e) =>
                            handleRowRoleChange(row.id, e.target.value)
                          }
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {row.commission_percent != null
                          ? `${Number(row.commission_percent).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(row)}
                          disabled={savingRowId === row.id}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {savingRowId === row.id ? "Guardando…" : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
