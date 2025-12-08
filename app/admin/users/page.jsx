// app/admin/users/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const ROLE_OPTIONS = [
  { value: 'user', label: 'Usuario normal' },
  { value: 'premium', label: 'Premium (2% comisión)' },
  { value: 'super_premium', label: 'Super premium (0% comisión)' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // 1) Verificar sesión + rol admin
  useEffect(() => {
    const checkSessionAndRole = async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        // No hay sesión → mandar a login
        router.push('/login');
        return;
      }

      // Traer perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setErrorMsg('No pudimos cargar tu perfil. Intenta nuevamente.');
        setLoading(false);
        return;
      }

      // Solo admins pueden ver esta página
      if (profile.role !== 'admin') {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Cargar listado de usuarios
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

    checkSessionAndRole();
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

  const handleToggleBlock = async (userId, currentValue) => {
    try {
      setSavingId(userId);
      setErrorMsg(null);

      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !currentValue })
        .eq('id', userId);

      if (error) {
        console.error(error);
        setErrorMsg('No se pudo actualizar el estado del usuario.');
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                is_blocked: !currentValue,
              }
            : u
        )
      );
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;

    return (
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.rut && u.rut.toLowerCase().includes(term)) ||
      (u.full_name && u.full_name.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Sin acceso
          </h1>
          <p className="text-sm text-gray-500">
            Esta sección es solo para administradores. Si crees que esto es un
            error, escríbenos a{' '}
            <span className="font-medium text-blue-600">
              soporte@tixswap.cl
            </span>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        {/* Título */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
            <p className="text-sm text-gray-500">
              Administra roles, bloquea cuentas y busca usuarios por correo,
              nombre o RUT.
            </p>
          </div>
        </div>

        {/* Filtros / búsqueda */}
        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="w-full md:w-80">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por correo, nombre o RUT..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <p className="text-xs text-gray-500">
            Total usuarios: {users.length}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Tabla de usuarios */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Correo
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  RUT
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Rol
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Estado
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs text-gray-400"
                  >
                    No se encontraron usuarios con ese filtro.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-50 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-gray-900">
                      {u.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.full_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.rut || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role || 'user'}
                        onChange={(e) =>
                          handleChangeRole(u.id, e.target.value)
                        }
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={savingId === u.id}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_blocked ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleBlock(u.id, !!u.is_blocked)
                        }
                        disabled={savingId === u.id}
                        className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-medium transition ${
                          u.is_blocked
                            ? 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                            : 'border-red-500 text-red-700 hover:bg-red-50'
                        } ${
                          savingId === u.id
                            ? 'opacity-60 cursor-not-allowed'
                            : ''
                        }`}
                      >
                        {savingId === u.id
                          ? 'Guardando...'
                          : u.is_blocked
                          ? 'Desbloquear'
                          : 'Bloquear'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          Tip: recuerda que los usuarios con rol{' '}
          <span className="font-semibold">premium</span> y{' '}
          <span className="font-semibold">super premium</span> pueden tener
          comisiones más bajas. Asegúrate de que este rol coincida con la
          lógica que uses para calcular las comisiones.
        </p>
      </div>
    </div>
  );
}
