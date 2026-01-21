'use client';

import { useState } from 'react';

export default function AvatarUploadSection({ currentAvatarUrl, userId, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentAvatarUrl);
  const [showModal, setShowModal] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo subir el avatar');
      }

      setPreview(json.avatarUrl);
      onSuccess?.(json.avatarUrl);
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'No se pudo subir el avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!preview) return;
    if (!confirm('¿Eliminar tu foto de perfil?')) return;

    setError('');
    setDeleting(true);

    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo eliminar el avatar');
      }

      setPreview(null);
      onSuccess?.(null);
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el avatar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Avatar Section - Always Visible */}
      <div className="flex items-center gap-6">
        {/* Avatar Clickeable */}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="relative group flex-shrink-0 transition-transform hover:scale-105"
          title="Cambiar foto de perfil"
        >
          {preview ? (
            <img
              src={preview}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover border-3 border-slate-200 group-hover:border-blue-400 transition"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center text-slate-400 text-4xl border-3 border-slate-200 group-hover:border-blue-400 transition">
              📷
            </div>
          )}
          {/* Overlay hint */}
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
            <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition">
              Cambiar
            </span>
          </div>
        </button>

        {/* Info Section */}
        <div>
          <h3 className="text-sm font-bold text-slate-900">Foto de perfil</h3>
          <p className="text-xs text-slate-600 mt-1">
            Haz clic en tu foto para cambiarla
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
            disabled={uploading || deleting}
          >
            {uploading ? 'Subiendo...' : 'Cambiar foto'}
          </button>
        </div>
      </div>

      {/* Modal para cambiar foto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Cambiar foto de perfil</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Preview */}
              <div className="flex justify-center">
                {preview ? (
                  <img
                    src={preview}
                    alt="Avatar"
                    className="w-32 h-32 rounded-full object-cover border-3 border-slate-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center text-slate-400 text-5xl border-3 border-slate-200">
                    📷
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <label className="relative flex items-center justify-center cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading || deleting}
                  className="hidden"
                />
                <span className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold text-center transition">
                  {uploading ? 'Subiendo...' : 'Seleccionar imagen'}
                </span>
              </label>

              <p className="text-xs text-slate-500 text-center">
                Imágenes hasta 2MB (jpg, png, webp, gif, heic, etc.)
              </p>

              {/* Delete Button */}
              {preview && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || uploading}
                  className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm font-semibold transition"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar foto'}
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setError('');
                }}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-semibold transition"
                disabled={uploading || deleting}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
