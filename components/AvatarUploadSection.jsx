'use client';

import { useState } from 'react';
import { uploadAvatar, deleteAvatar } from '@/lib/profileActions';

export default function AvatarUploadSection({ currentAvatarUrl, userId, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentAvatarUrl);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    try {
      const result = await uploadAvatar(file, userId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setPreview(result.avatarUrl);
      onSuccess?.(result.avatarUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!preview) return;
    if (!confirm('¿Eliminar tu avatar?')) return;

    setError('');
    setDeleting(true);

    try {
      const result = await deleteAvatar(userId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setPreview(null);
      onSuccess?.(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Avatar
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || uploading}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
              title="Eliminar avatar"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl">
            👤
          </div>
        )}

        <div className="flex-1">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading || deleting}
              className="hidden"
            />
            <span className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {uploading ? 'Subiendo...' : 'Cambiar'}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            JPG, PNG o WebP. Max 2MB.
          </p>
        </div>
      </div>
    </div>
  );
}
