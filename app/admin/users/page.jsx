// app/admin/users/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { ROLE_OPTIONS, normalizeRole } from "@/lib/roles";

export default function AdminUsersPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // edición local por fila (no auto-save)
  const [edits, setEdits] = useState({}); // { [id]: { email, phone } }

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

    // preload edits
    const initEdits = {};
    (allUsers || []).forEach((u) => {
      initEdits[u.id] = {
        email: u.email || "",
        phone: u.phone || "",
      };
    });
    setEdits(initEdits);

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

  const handleChangeRole = async (userId, newRole) => {
    try {
      setSavingId(userId);
      setErrorMsg(null);

      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo actualizar el rol.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleBlock = async (userId, current) => {
    try {
      setSavingId(userId);
      setErrorMsg(null);

      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: !current })
        .eq("id", userId);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo actualizar el estado.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_blocked: !current } : u))
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleEditField = (userId, field) => (e) => {
    const value = e.target.value;
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const handleSaveContact = async (userId) => {
    try {
      setSavingId(userId);
      setErrorMsg(null);

      const payload = {
        email: (edits[userId]?.email || "").trim(),
        phone: (edits[userId]?.phone || "").trim(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo guardar correo/teléfono.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...payload } : u))
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleResetContact = (userId) => {
    const u = users.find((x) => x.id === userId);
    setEdits((prev) => ({
      ...prev,
      [userId]: { email: u?.email || "", phone: u?.phone || "" },
    }));
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
                <th className="py-3 px-4 text-left font-medium">Correo (contacto)</th>
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
                filtered.map((u) => {
                  const rowEdit = edits[u.id] || { email: u.email || "", phone: u.phone || "" };
                  const isDirty = rowEdit.email !== (u.email || "") || rowEdit.phone !== (u.phone || "");
                  const disabled = savingId === u.id;

                  return (
                    <tr key={u.id} className="border-t border-slate-100">
                      <td className="py-3 px-4">
                        <input
                          value={rowEdit.email}
                          onChange={handleEditField(u.id, "email")}
                          disabled={disabled}
                          className="w-[260px] border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">
                          *Correo de contacto (no cambia el login)
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <input
                          value={rowEdit.phone}
                          onChange={handleEditField(u.id, "phone")}
                          disabled={disabled}
                          className="w-[160px] border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                          placeholder="+56 9..."
                        />
                      </td>

                      <td className="py-3 px-4 text-slate-700">{u.full_name || "—"}</td>
                      <td className="py-3 px-4 text-slate-700">{u.rut || "—"}</td>

                      <td className="py-3 px-4">
                        <select
                          value={normalizeRole(u.role || "basic")}
                          disabled={disabled}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-4">
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

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleToggleBlock(u.id, !!u.is_blocked)}
                            disabled={disabled}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                              u.is_blocked
                                ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                            }`}
                          >
                            {u.is_blocked ? "Desbloquear" : "Bloquear"}
                          </button>

                          <button
                            onClick={() => handleSaveContact(u.id)}
                            disabled={disabled || !isDirty}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Guardar
                          </button>

                          <button
                            onClick={() => handleResetContact(u.id)}
                            disabled={disabled || !isDirty}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          Tip: roles y comisiones — Básico (3,5%), Pro (2,5%), Premium (1,5%), Elite (0,5%) y Ultra Premium (0%).
          Ultra Premium es por invitación/manual.
        </p>
      </div>
    </div>
  );
}
