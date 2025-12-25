'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { formatRut, validateRut } from '../lib/rutUtils';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    rut: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Por ahora, el rol lo dejamos fijo y lo maneja el admin después (puedes cambiarlo cuando quieras).
  const DEFAULT_ROLE = 'basic';

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isFormComplete = useMemo(() => {
    const { fullName, rut, email, phone, password, confirmPassword } = formData;
    return (
      fullName.trim() &&
      rut.trim() &&
      email.trim() &&
      phone.trim() &&
      password &&
      confirmPassword
    );
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Formateo suave del RUT mientras escribe
    if (name === 'rut') {
      setFormData((prev) => ({ ...prev, rut: formatRut(value) }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    setErrorMessage('');
    setSuccessMessage('');

    const { fullName, rut, email, phone, password, confirmPassword } = formData;

    if (!isFormComplete) {
      setErrorMessage('Completa todos los campos para crear tu cuenta.');
      return;
    }

    if (!acceptTerms) {
      setErrorMessage('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }

    const rutClean = rut.replace(/\./g, '').toUpperCase();
    if (!validateRut(rutClean)) {
      setErrorMessage('El RUT ingresado no es válido.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    try {
      setIsSubmitting(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            rut: rutClean,
            phone: phone.trim(),
            role: DEFAULT_ROLE, // <- admin lo puede cambiar después
          },
        },
      });

      if (error) {
        setErrorMessage(error.message || 'No pudimos crear tu cuenta. Intenta de nuevo.');
        return;
      }

      // Supabase puede devolver session null si requiere confirmación por email.
      const needsEmailConfirm = !data?.session;

      setSuccessMessage(
        needsEmailConfirm
          ? 'Cuenta creada ✅ Revisa tu correo para confirmar y luego inicia sesión.'
          : 'Cuenta creada ✅ Ya puedes iniciar sesión.'
      );

      // Limpia el form
      setFormData({
        fullName: '',
        rut: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
      setAcceptTerms(false);

      // Llévalo al login para que siga el flujo
      router.push('/login?registered=1');
    } catch (err) {
      setErrorMessage('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
        <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
        <p className="mt-1 text-gray-600">
          Regístrate para comprar y vender entradas de forma segura.
        </p>

        {(errorMessage || successMessage) && (
          <div className="mt-4 space-y-2">
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
                {successMessage}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
            <input
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Ej: Juan Pérez"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">RUT</label>
            <input
              name="rut"
              type="text"
              value={formData.rut}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Ej: 12.345.678-9"
              inputMode="text"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-gray-500">
              Validaremos que el RUT sea correcto (incluyendo dígito verificador).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="tu@correo.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="+56912345678"
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Repetir contraseña</label>
            <input
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                He leído y acepto los{' '}
                <Link href="/legal/terms" className="text-blue-600 hover:underline">
                  Términos y Condiciones
                </Link>{' '}
                de TixSwap.
                <span className="block mt-1 text-xs text-gray-500">
                  Si no aceptas los Términos, no podrás crear tu cuenta.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!acceptTerms || isSubmitting}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
