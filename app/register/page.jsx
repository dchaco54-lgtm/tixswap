'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { validateRut, formatRut } from '../../lib/rutUtils';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+56');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  // Rol default interno (no se muestra al usuario)
  const DEFAULT_ROLE = 'basic';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
      return;
    }

    if (!fullName.trim()) {
      setError('Por favor ingresa tu nombre completo.');
      return;
    }

    const cleanedRut = rut.trim();
    if (!validateRut(cleanedRut)) {
      setError('El RUT ingresado no es válido.');
      return;
    }

    if (!email.trim()) {
      setError('Por favor ingresa tu correo.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 8) {
      setError('Por favor ingresa un teléfono válido.');
      return;
    }

    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const formattedRut = formatRut(cleanedRut);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            rut: formattedRut,
            phone: phone.trim(),
            role: DEFAULT_ROLE,
          },
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/login`
              : undefined,
        },
      });

      if (signUpError) {
        const msg = (signUpError.message || '').toLowerCase();

        if (msg.includes('user already registered') || msg.includes('already registered')) {
          setError('Este correo ya está registrado. Inicia sesión.');
        } else if (msg.includes('duplicate') || msg.includes('unique')) {
          setError('Ya existe una cuenta con esos datos.');
        } else {
          setError(signUpError.message || 'No se pudo crear la cuenta.');
        }
        return;
      }

      // Si signUp ok, Supabase envía correo de confirmación (si tienes email confirmations ON)
      setSuccess('Cuenta creada. Revisa tu correo para confirmar tu cuenta.');
      // opcional: router.push('/login');
    } catch (err) {
      setError(err?.message || 'Database error saving new user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-600 mt-1">
            Regístrate para comprar y vender entradas de forma segura.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Nombre completo
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">RUT</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12.345.678-9"
              />
              <p className="text-xs text-gray-500 mt-1">
                Validaremos que el RUT sea correcto (incluyendo dígito verificador).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">
                Correo electrónico
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Teléfono</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+569XXXXXXXX"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Contraseña</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">
                Repetir contraseña
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  He leído y acepto los{' '}
                  <Link
                    href="/legal/terms"
                    className="text-blue-600 hover:underline"
                    target="_blank"
                  >
                    Términos y Condiciones
                  </Link>{' '}
                  de TixSwap.
                  <div className="text-xs text-gray-500 mt-1">
                    Si no aceptas los Términos, no podrás crear tu cuenta.
                  </div>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!acceptedTerms || loading}
              className={`w-full mt-2 rounded-xl px-4 py-3 font-semibold text-white transition ${
                !acceptedTerms || loading
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Creando...' : 'Crear cuenta'}
            </button>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                {success}
              </div>
            )}

            <p className="text-sm text-gray-600 text-center mt-4">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
