// app/admin/users/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { ROLE_OPTIONS, normalizeRole } from '@/lib/roles';

export default function AdminUsersPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const init = async () => {
      setChecking(true);
      setErrorMsg(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Verificar admin por profiles.role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setErrorMsg('No pudimos cargar tu perfil.');
        setChecking(false);
        return;
      }

      if (profile?.role !== 'admin') {
        setErrorMsg('No tienes permisos para ver esta página.');
        setChecking(false);
        return;
      }

      setIsAdmin(true);
      setChecking(false);

      // Cargar usuarios
      setLoading(true);
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, rut, role, is_blocked')
        .order('email', { ascending: true });

      if (usersError) {
        console.error(usersError);
        setErrorMsg('No pudimos cargar los usuarios.');
        setLoading(false);
        return;
      }

      setUsers(allUsers || []);
      setLoading(false);
    };

    init();
  }, [router]);

  const handleChangeRole = async (userId, newRole) => {
    try {
      setSavingId(userId);
      setErrorMsg(null);

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        console.error(error);
        setErrorMsg('No se pudo actualizar el rol.');
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: newRole,
              }
            : u
        )
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
        .from('profiles')
        .update({ is_blocked: !current })
        .eq('id', userId);

      if (error) {
        console.error(error);
        setErrorMsg('No se pudo actualizar el estado.');
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                is_blocked: !current,
              }
            : u
        )
      );
    } finally {
      setSavingId(null);
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
        <p className="text-slate-600">{errorMsg || 'No autorizado.'}</p>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const email = (u.email || '').toLowerCase();
    const name = (u.full_name || '').toLowerCase();
    const rut = (u.rut || '').toLowerCase();
    return email.includes(q) || name.includes(q) || rut.includes(q);
  });

  return (
    <div className="tix-container tix-section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-slate-600 mt-1">
            Administra roles, bloquea cuentas y busca usuarios por correo, nombre o RUT.
          </p>
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
                  <td className="py-6 px-4 text-slate-600" colSpan={6}>
                    Cargando usuarios…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-slate-600" colSpan={6}>
                    No encontramos usuarios para tu búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-3 px-4 text-slate-900">{u.email || '—'}</td>
                    <td className="py-3 px-4 text-slate-700">{u.full_name || '—'}</td>
                    <td className="py-3 px-4 text-slate-700">{u.rut || '—'}</td>

                    <td className="py-3 px-4">
                      <select
                        value={normalizeRole(u.role || 'basic')}
                        disabled={savingId === u.id}
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
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-green-50 text-green-700 border border-green-200'
                        }`}
                      >
                        {u.is_blocked ? 'Bloqueado' : 'Activo'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleBlock(u.id, !!u.is_blocked)}
                        disabled={savingId === u.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                          u.is_blocked
                            ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                        }`}
                      >
                        {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          Tip: roles y comisiones —{" "}
          <span className="font-semibold">Básico</span> (3,5%),{" "}
          <span className="font-semibold">Pro</span> (2,5%),{" "}
          <span className="font-semibold">Premium</span> (1,5%),{" "}
          <span className="font-semibold">Elite</span> (0,5%) y{" "}
          <span className="font-semibold">Ultra Premium</span> (0%).
          Ultra Premium es por invitación/manual. Asegúrate de que este rol coincida con la lógica que uses para calcular las comisiones.
        </p>
      </div>
    </div>
  );
}
