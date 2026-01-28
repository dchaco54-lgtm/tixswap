// components/RatingModal.jsx
import { useEffect, useMemo, useState } from "react";

const LABELS = ["Pesimo", "Malo", "Medio", "Bueno", "Excelente"];

export default function RatingModal({
  open,
  title = "Calificar",
  onClose,
  onSubmit,
  submitting = false,
  error = "",
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) {
      setStars(0);
      setComment("");
    }
  }, [open]);

  const label = useMemo(() => {
    if (!stars) return "Sin calificar";
    return `${stars} · ${LABELS[stars - 1]}`;
  }, [stars]);

  const handleSubmit = () => {
    if (!stars || submitting) return;
    onSubmit({ stars, comment: comment.trim() });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">
              1 Pesimo · 3 Medio · 5 Excelente
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = stars >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className={`text-2xl leading-none ${
                    active ? "text-amber-500" : "text-slate-300"
                  }`}
                  aria-label={`Calificacion ${n}`}
                >
                  ★
                </button>
              );
            })}
          </div>
          <span className="text-sm text-slate-600">{label}</span>
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600">Comentario (opcional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            rows={3}
            placeholder="Cuéntanos tu experiencia"
          />
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!stars || submitting}
            className={`rounded-xl px-4 py-2 text-sm text-white ${
              !stars || submitting
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
