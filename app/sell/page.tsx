'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SellPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);

  const [eventId, setEventId] = useState('');
  const [price, setPrice] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // 🔐 Auth
  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setUser(data.user);
      setLoading(false);
    };
    initAuth();
  }, [router]);

  if (loading) return <div className="p-6">Cargando...</div>;

  // 📎 Validación PDF
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF.');
      e.target.value = '';
      return;
    }

    setPdfFile(file);
  };

  // 🚀 Publicar entrada
  const handlePublish = async () => {
    if (!eventId || !price || !pdfFile) {
      alert('Completa todos los campos.');
      return;
    }

    try {
      setUploading(true);

      // 1️⃣ Subir PDF a Storage
      const filePath = `${user.id}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('tickets')
        .upload(filePath, pdfFile, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2️⃣ Guardar registro en DB
      const { error: insertError } = await supabase
        .from('tickets_for_sale')
        .insert({
          user_id: user.id,
          event_id: eventId,
          price: Number(price),
          ticket_pdf_path: filePath,
          status: 'pending_validation',
        });

      if (insertError) throw insertError;

      alert('Entrada publicada y enviada a validación.');
      router.push('/dashboard');

    } catch (err: any) {
      console.error(err);
      alert('Error al publicar la entrada.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Vender entrada</h1>

      {/* PASO 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            Evento ID
            <input
              className="input"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            />
          </label>

          <label className="block">
            Precio
            <input
              type="number"
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>

          <button className="btn-primary" onClick={() => setStep(2)}>
            Continuar
          </button>
        </div>
      )}

      {/* PASO 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Sube tu entrada (PDF)</h2>

          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
          />

          <p className="text-sm text-gray-500">
            Solo se acepta formato PDF. La entrada será validada antes de publicarse.
          </p>

          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              Volver
            </button>

            <button
              className="btn-primary"
              disabled={!pdfFile || uploading}
              onClick={handlePublish}
            >
              {uploading ? 'Publicando...' : 'Publicar entrada'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
