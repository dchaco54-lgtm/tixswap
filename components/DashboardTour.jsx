'use client';

import { useEffect, useState } from 'react';

const TOUR_STORAGE_KEY = 'tixswap_onboarding_tour_completed';

const TOUR_STEPS = [
  {
    id: 'wallet',
    title: '💰 Configura tu Wallet',
    description: 'Administra tus fondos y solicita retiros de manera segura.',
    target: '[data-tour-id="wallet"]',
  },
  {
    id: 'sell',
    title: '🎫 Publica una entrada',
    description: 'Vende tus tickets de forma rápida y segura.',
    target: '[data-tour-id="sell"]',
  },
  {
    id: 'sales',
    title: '📊 Revisa tus ventas',
    description: 'Monitorea el estado y detalles de tus ventas.',
    target: '[data-tour-id="sales"]',
  },
  {
    id: 'purchases',
    title: '🛍️ Revisa tus compras',
    description: 'Accede a tus tickets comprados y su información.',
    target: '[data-tour-id="purchases"]',
  },
  {
    id: 'support',
    title: '💬 Soporte',
    description: 'Contáctanos si necesitas ayuda en cualquier momento.',
    target: '[data-tour-id="support"]',
  },
];

export default function DashboardTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detectar si es móvil
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (currentStep >= TOUR_STEPS.length) return;

    const updatePosition = () => {
      const step = TOUR_STEPS[currentStep];
      const element = document.querySelector(step.target);

      if (element) {
        const rect = element.getBoundingClientRect();
        
        if (isMobile) {
          // En móvil, mostrar como bottom sheet
          setPosition({
            type: 'mobile',
            highlight: {
              top: rect.top + window.scrollY,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
          });
        } else {
          // En desktop, tooltip al lado del elemento
          setPosition({
            type: 'desktop',
            top: rect.top + window.scrollY + rect.height / 2,
            left: rect.right + 20,
            highlight: {
              top: rect.top + window.scrollY,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
          });
        }
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStep, isMobile]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    onComplete?.();
  };

  // Prevenir scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (!position) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <>
      {/* Overlay oscuro */}
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={handleSkip} />

      {/* Highlight del elemento */}
      <div
        className="fixed z-[61] pointer-events-none"
        style={{
          top: `${position.highlight.top}px`,
          left: `${position.highlight.left}px`,
          width: `${position.highlight.width}px`,
          height: `${position.highlight.height}px`,
        }}
      >
        <div className="absolute inset-0 ring-4 ring-blue-500 ring-offset-2 rounded-lg animate-pulse" />
      </div>

      {/* Tooltip / Bottom Sheet */}
      {isMobile ? (
        // Mobile: Bottom Sheet
        <div className="fixed bottom-0 left-0 right-0 z-[62] bg-white rounded-t-3xl shadow-2xl p-6 animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="text-xs font-bold text-blue-600 mb-1">
                Paso {currentStep + 1} de {TOUR_STEPS.length}
              </div>
              <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
            </div>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 ml-2"
              aria-label="Cerrar tour"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-gray-600 mb-6">{step.description}</p>

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Saltar tour
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              {currentStep < TOUR_STEPS.length - 1 ? 'Siguiente' : 'Finalizar'}
            </button>
          </div>
        </div>
      ) : (
        // Desktop: Tooltip
        <div
          className="fixed z-[62] bg-white rounded-xl shadow-2xl p-5 w-80 animate-fade-in"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateY(-50%)',
          }}
        >
          {/* Arrow */}
          <div className="absolute top-1/2 -left-2 -translate-y-1/2">
            <div className="w-4 h-4 bg-white rotate-45 shadow-lg" />
          </div>

          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-blue-600">
                Paso {currentStep + 1} de {TOUR_STEPS.length}
              </div>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1"
                aria-label="Cerrar tour"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{step.description}</p>

            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Saltar
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                {currentStep < TOUR_STEPS.length - 1 ? 'Siguiente →' : '¡Listo!'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

export function shouldShowTour() {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(TOUR_STORAGE_KEY);
}

export function resetTour() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
