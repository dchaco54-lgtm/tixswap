'use client';

import { useState } from 'react';
import { createProfileChangeTicket } from '@/lib/profileActions';

export default function ProfileChangeModal({ field, currentValue, onClose, onSuccess }) {
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await createProfileChangeTicket(field, requestedValue, reason);
      
      if (!result.success) {
        setError(result.error);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fieldLabel = field === 'email' ? 'Email' : field === 'name' ? 'Nombre' : 'RUT';
  const placeholder = field === 'email' ? 'nuevo@email.com' : field === 'name' ? 'Juan Pérez' : '12.345.678-K';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold mb-4">Solicitar cambio de {fieldLabel}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nuevo {fieldLabel}
            </label>
            <input
              type={field === 'email' ? 'email' : 'text'}
              value={requestedValue}
              onChange={(e) => setRequestedValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cuéntanos por qué deseas cambiar tu información"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !requestedValue.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Solicitar cambio'}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-500 mt-4">
          {field === 'email'
            ? 'Se enviará una solicitud a nuestro equipo. Te notificaremos cuando sea procesada.'
            : field === 'name'
            ? 'Se enviará una solicitud a nuestro equipo para verificar tu identidad.'
            : 'Se enviará una solicitud a nuestro equipo. Deberás verificar tu nuevo RUT.'}
        </p>
      </div>
    </div>
  );
}
