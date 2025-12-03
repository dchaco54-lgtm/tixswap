"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      setLoading(false);
    };

    loadUser();
  }, [router]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Cargando tu cuenta...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const meta = user.user_metadata || {};

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-soft p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Hola, {meta.full_name || "usuario"} 👋
            </h1>
            <p className="text-sm text-gray-500">
              Este es tu panel de cuenta en TixSwap.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Datos de la cuenta
            </h2>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Correo:</span> {user.email}
            </p>
            {meta.rut && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">RUT:</span> {meta.rut}
              </p>
            )}
            {meta.phone && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Teléfono:</span> {meta.phone}
              </p>
            )}
            {meta.user_type && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Tipo de usuario:</span>{" "}
                {meta.user_type}
              </p>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Estado
            </h2>
            <p className="text-sm text-gray-600">
              Por ahora este es un resumen simple de tu cuenta. Más adelante
              aquí vas a ver:
            </p>
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
              <li>Entradas en venta</li>
              <li>Compras realizadas</li>
              <li>Verificación de identidad / medios de pago</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
