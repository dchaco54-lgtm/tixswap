'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Modal de bienvenida para nuevos usuarios
 * 
 * Props:
 * - onClose: callback al cerrar (sin completar)
 * - onComplete: callback al completar
 * - profile: datos del usuario
 */
export default function OnboardingWelcomeModal({ onClose, onComplete, profile }) {
  const [step, setStep] = useState(0); // 0=welcome, 1-3=checklist
  const steps = [
    {
      id: 'welcome',
      title: '¡Bienvenido a TixSwap! 🎫',
      description: 'Configura tu cuenta en 1 minuto (opcional).',
      items: null, // welcome step no tiene items
    },
    {
      id: 'photo',
      title: '📸 Sube una foto',
      description: 'Una foto profesional te ayuda a ganar confianza.',
      icon: '📸',
      link: null, // se completa en dashboard
      completed: !!profile?.avatar_url,
    },
    {
      id: 'wallet',
      title: '💰 Configura tu Wallet',
      description: 'Para recibir pagos de tus ventas.',
      icon: '💰',
      link: '/dashboard?tab=wallet',
      completed: !!profile?.wallet_configured, // si existe campo
    },
    {
      id: 'explore',
      title: '🛍️ Explora Comprar & Vender',
      description: 'Descubre cómo funciona TixSwap.',
      icon: '🛍️',
      subItems: [
        { label: 'Comprar Entradas', href: '/comprar' },
        { label: 'Vender Entradas', href: '/vender' },
      ],
      completed: false, // manual
    },
  ];

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleDismiss = () => {
    console.log('[Onboarding] Dismissing at step:', step);
    onClose?.();
  };

  const handleNextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    console.log('[Onboarding] Completed!');
    onComplete?.();
  };

  const handleSkipAll = () => {
    console.log('[Onboarding] Skipping all');
    onComplete?.(); // Mark as completed incluso si no hizo nada
  };

  const currentStep = steps[step];

  // Welcome step
  if (step === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-8 relative animate-in fade-in zoom-in-95">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2 text-gray-900">{currentStep.title}</h2>
            <p className="text-gray-600 mb-8">{currentStep.description}</p>

            {/* Welcome icons */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-blue-50">
                <div className="text-3xl mb-1">📸</div>
                <p className="text-xs font-medium text-gray-600">Foto</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50">
                <div className="text-3xl mb-1">💰</div>
                <p className="text-xs font-medium text-gray-600">Wallet</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50">
                <div className="text-3xl mb-1">🛍️</div>
                <p className="text-xs font-medium text-gray-600">Explorar</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleNextStep}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                Comenzar Configuración
              </button>
              <button
                onClick={handleSkipAll}
                className="w-full border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition"
              >
                Actualizar Más Tarde
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Checklist steps (1-3)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-8 relative animate-in fade-in zoom-in-95">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Cerrar"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-blue-600">
              Paso {step} de {steps.length - 1}
            </div>
          </div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="text-4xl mb-3">{currentStep.icon}</div>
          <h2 className="text-2xl font-bold mb-2 text-gray-900">{currentStep.title}</h2>
          <p className="text-gray-600 mb-6">{currentStep.description}</p>

          {/* Sub items si existen */}
          {currentStep.subItems && (
            <div className="space-y-2 mb-6">
              {currentStep.subItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-left text-sm font-medium text-gray-700"
                >
                  {item.label} →
                </Link>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleNextStep}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              {step < steps.length - 1 ? 'Siguiente →' : '¡Completado! 🎉'}
            </button>
            <button
              onClick={handleSkipAll}
              className="w-full border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition"
            >
              Saltar Tour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
