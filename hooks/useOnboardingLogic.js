import { useEffect, useState } from 'react';

const ONBOARDING_STORAGE_KEY = 'tixswap_onboarding';
const RATE_LIMIT_HOURS = 24;

/**
 * Hook para controlar cuándo mostrar el onboarding modal
 * 
 * Reglas:
 * - Si onboarding_completed = true, nunca mostrar
 * - Si onboarding_dismissed_at existe y fue hace <24h, no mostrar
 * - Si onboarding_dismissed_at existe pero hace >24h, mostrar
 * - Si nunca fue dismissido, mostrar
 */
export function useOnboardingLogic(profile) {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si no hay profile, no hacer nada
    if (!profile || !profile.id) {
      setShouldShow(false);
      setLoading(false);
      return;
    }

    // Si ya completó, nunca mostrar
    if (profile.onboarding_completed === true) {
      console.log('[Onboarding] Ya completado, no mostrar');
      setShouldShow(false);
      setLoading(false);
      return;
    }

    // Si fue dismissido hace poco, no mostrar
    if (profile.onboarding_dismissed_at) {
      try {
        const dismissedAt = new Date(profile.onboarding_dismissed_at).getTime();
        const now = Date.now();
        const hoursAgo = (now - dismissedAt) / (1000 * 60 * 60);

        console.log(`[Onboarding] Dismissido hace ${hoursAgo.toFixed(1)} horas`);

        if (hoursAgo < RATE_LIMIT_HOURS) {
          console.log('[Onboarding] Rate limit activo, no mostrar');
          setShouldShow(false);
          setLoading(false);
          return;
        }

        console.log('[Onboarding] Rate limit expirado, mostrar de nuevo');
      } catch (err) {
        console.error('[Onboarding] Error parseando dismissed_at:', err);
        // Si hay error, no mostrar por seguridad
        setShouldShow(false);
        setLoading(false);
        return;
      }
    }

    // Mostrar modal
    setShouldShow(true);
    setLoading(false);
  }, [profile]);

  const handleDismiss = async () => {
    if (!profile) return;

    // Actualizar BD
    try {
      const response = await fetch('/api/profile/onboarding-dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      });

      if (response.ok) {
        console.log('[Onboarding] Dismissido, rate limit 24h');
        setShouldShow(false);
      }
    } catch (err) {
      console.error('[Onboarding] Error al dismissir:', err);
    }
  };

  const handleComplete = async () => {
    if (!profile) return;

    // Actualizar BD
    try {
      const response = await fetch('/api/profile/onboarding-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      });

      if (response.ok) {
        console.log('[Onboarding] Completado permanentemente');
        setShouldShow(false);
      }
    } catch (err) {
      console.error('[Onboarding] Error al completar:', err);
    }
  };

  return {
    shouldShow,
    loading,
    handleDismiss,
    handleComplete,
  };
}
