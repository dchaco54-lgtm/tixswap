'use client';

import { useEffect, useRef } from 'react';

export default function OnboardingModal({ onComplete, onSkip }) {
  const modalRef = useRef(null);
  const firstButtonRef = useRef(null);

  // Focus trap básico
  useEffect(() => {
    // Focus en el primer botón al abrir
    firstButtonRef.current?.focus();

    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape' && onSkip) {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onSkip]);

  const handleComplete = () => {
    onComplete?.();
  };

  const handleSkipClick = () => {
    onSkip?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl animate-modal-in"
        role="dialog"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <h2 id="onboarding-title" className="text-2xl font-bold mb-2">
          ¡Bienvenido a TixSwap! 🎫
        </h2>
        <p id="onboarding-description" className="text-gray-600 mb-6 text-sm leading-relaxed">
          Completar tu perfil te ayudará a comprar, vender y conectarte con otros usuarios de forma segura.
        </p>

        <div className="space-y-3 mb-6">
          <div className="flex gap-3 items-start">
            <span className="text-xl">📝</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Nombre completo</h3>
              <p className="text-xs text-gray-500">Para identificarte en tus transacciones</p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <span className="text-xl">📞</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Teléfono</h3>
              <p className="text-xs text-gray-500">Para coordinar entregas y contacto</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {onSkip && (
            <button
              onClick={handleSkipClick}
              className="w-full sm:w-1/2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              aria-label="Actualizar perfil más tarde"
            >
              Actualizar más tarde
            </button>
          )}
          <button
            ref={firstButtonRef}
            onClick={handleComplete}
            className={`w-full ${onSkip ? 'sm:w-1/2' : ''} px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors`}
            aria-label="Actualizar perfil ahora"
          >
            Actualizar ahora
          </button>
        </div>

        {onSkip && (
          <p className="text-xs text-gray-500 text-center mt-4">
            Puedes completarlo cuando quieras desde tu panel.
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-modal-in {
          animation: modal-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
