// app/admin/users/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ROLE_OPTIONS, normalizeRole, roleCommissionLabel } from "@/lib/roles";

export default function AdminUsersPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

  // modal edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    rut: "",
    email: "",
    phone: "",
    role: "basic",
    is_blocked: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setChecking(true);
      setErrorMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Validar admin por profiles.role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setErrorMsg("No pudimos cargar tu perfil.");
        setChecking(false);
        return;
      }

      if (profile?.role !== "admin") {
        setErrorMsg("No tienes permisos para ver esta página.");
        setChecking(false);
        return;
      }

      setIsAdmin(true);
      setChecking(false);

      await fetchUsers();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: allUsers, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, phone, full_name, rut, role, is_blocked")
      .order("email", { ascending: true });

    if (usersError) {
      console.error(usersError);
      setErrorMsg("No pudimos cargar los usuarios.");
      setLoading(false);
      return;
    }

    setUsers(allUsers || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const email = (u.email || "").toLowerCase();
      const name = (u.full_name || "").toLowerCase();
      const rut = (u.rut || "").toLowerCase();
      return email.includes(q) || name.includes(q) || rut.includes(q);
    });
  }, [query, users]);

  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditForm({
      full_name: u.full_name || "",
      rut: u.rut || "",
      email: u.email || "",
      phone: u.phone || "",
      role: normalizeRole(u.role || "basic"),
      is_blocked: !!u.is_blocked,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setSaving(false);
    setEditForm({
      full_name: "",
      rut: "",
      email: "",
      phone: "",
      role: "basic",
      is_blocked: false,
    });
  };

  const handleFormChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!selectedUser?.id) return;

    try {
      setSaving(true);
      setErrorMsg(null);

      const payload = {
        full_name: String(editForm.full_name || "").trim(),
        rut: String(editForm.rut || "").trim(),
        email: String(editForm.email || "").trim().toLowerCase(),
        phone: String(editForm.phone || "").trim(),
        role: normalizeRole(editForm.role || "basic"),
        is_blocked: !!editForm.is_blocked,
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", selectedUser.id);

      if (error) {
        console.error(error);
        setErrorMsg(
          error.message || "No se pudo guardar el perfil. Revisa los datos."
        );
        return;
      }

      // reflejar en tabla (sin recargar todo)
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, ...payload } : u))
      );

      closeModal();
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="tix-container tix-section">
        <p className="text-slate-600">Cargando…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="tix-container tix-section">
        <h1 className="text-2xl font-bold mb-2">Usuarios</h1>
        <p className="text-slate-600">{errorMsg || "No autorizado."}</p>
      </div>
    );
  }

  return (
    <div className="tix-container tix-section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-slate-600 mt-1">
            Administra roles, bloquea cuentas y busca usuarios por correo, nombre o RUT.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              ← Volver a mi cuenta
            </button>

            <button
              onClick={fetchUsers}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Recargar usuarios
            </button>
          </div>
        </div>

        <div className="text-sm text-slate-500 mt-2">
          Total usuarios: <b>{users.length}</b>
        </div>
      </div>

      <div className="mt-6">
        {errorMsg ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por correo, nombre o RUT…"
          className="w-full max-w-md border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Correo</th>
                <th className="py-3 px-4 text-left font-medium">Teléfono</th>
                <th className="py-3 px-4 text-left font-medium">Nombre</th>
                <th className="py-3 px-4 text-left font-medium">RUT</th>
                <th className="py-3 px-4 text-left font-medium">Rol</th>
                <th className="py-3 px-4 text-left font-medium">Estado</th>
                <th className="py-3 px-4 text-left font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="py-6 px-4 text-slate-600" colSpan={7}>
                    Cargando usuarios…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-slate-600" colSpan={7}>
                    No encontramos usuarios para tu búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-2.5 px-4 text-slate-800">
                      <div className="max-w-[260px] truncate">{u.email || "—"}</div>
                    </td>

                    <td className="py-2.5 px-4 text-slate-700">
                      {u.phone || "—"}
                    </td>

                    <td className="py-2.5 px-4 text-slate-700">
                      {u.full_name || "—"}
                    </td>

                    <td className="py-2.5 px-4 text-slate-700">
                      {u.rut || "—"}
                    </td>

                    <td className="py-2.5 px-4 text-slate-700">
                      {u.role ? roleCommissionLabel(u.role) : roleCommissionLabel("basic")}
                    </td>

                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          u.is_blocked
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-green-50 text-green-700 border border-green-200"
                        }`}
                      >
                        {u.is_blocked ? "Bloqueado" : "Activo"}
                      </span>
                    </td>

                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => openEditModal(u)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          Tip: roles solo para referencia visual. Tiers de segmentación: Free (fijado por admin), Básico, Pro, Premium, Elite.
        </p>
      </div>

      {/* MODAL */}
      {isModalOpen && selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={saving ? undefined : closeModal}
          />

          {/* card */}
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-100 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Editar usuario</h2>
                <p className="text-sm text-slate-500 mt-1">
                  ID: <span className="font-mono text-[12px]">{selectedUser.id}</span>
                </p>
              </div>

              <button
                onClick={saving ? undefined : closeModal}
                className="rounded-lg px-3 py-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre
                </label>
                <input
                  value={editForm.full_name}
                  onChange={handleFormChange("full_name")}
                  disabled={saving}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RUT
                </label>
                <input
                  value={editForm.rut}
                  onChange={handleFormChange("rut")}
                  disabled={saving}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo
                </label>
                <input
                  value={editForm.email}
                  onChange={handleFormChange("email")}
                  disabled={saving}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  value={editForm.phone}
                  onChange={handleFormChange("phone")}
                  disabled={saving}
                  placeholder="+569..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rol
                </label>
                <select
                  value={editForm.role}
                  onChange={handleFormChange("role")}
                  disabled={saving}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">Estado</p>
                  <p className="text-xs text-slate-500">
                    Si está bloqueado, no debería operar en la plataforma.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-sm">
                  <span className="text-slate-700">
                    {editForm.is_blocked ? "Bloqueado" : "Activo"}
                  </span>
                  <input
                    type="checkbox"
                    checked={editForm.is_blocked}
                    onChange={handleFormChange("is_blocked")}
                    disabled={saving}
                    className="h-4 w-4"
                  />
                </label>
              </div>
            </div>

            {errorMsg ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
