'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook para perfil del usuario con sincronización Realtime
 * 
 * @returns {Object} { profile, loading, error, refetch }
 */
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para cargar perfil
  const fetchProfile = async (user) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (data) {
        setProfile(data);
        return data;
      }

      const ensureRes = await fetch('/api/profile/ensure', { method: 'POST' });
      const ensureJson = await ensureRes.json().catch(() => ({}));

      if (ensureRes.ok && ensureJson?.profile) {
        setProfile(ensureJson.profile);
        return ensureJson.profile;
      }

      const fallbackProfile = {
        id: user.id,
        email: user.email || null,
        full_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          null,
        rut: user.user_metadata?.rut || null,
        phone: user.user_metadata?.phone || null,
        onboarding_completed: false,
      };

      setProfile(fallbackProfile);
      return fallbackProfile;
    } catch (err) {
      console.error('[useProfile] Error fetching:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Refetch manual
  const refetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return await fetchProfile(user);
    }
  };

  useEffect(() => {
    let subscription;
    let userId;

    const init = async () => {
      // 1. Obtener usuario actual
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setLoading(false);
        setError('No autenticado');
        return;
      }

      userId = user.id;

      // 2. Cargar perfil inicial
      await fetchProfile(user);

      // 3. Suscribirse a cambios en tiempo real
      subscription = supabase
        .channel(`profile:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            console.log('[useProfile] Realtime update:', payload);
            
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              setProfile(payload.new);
            } else if (payload.eventType === 'DELETE') {
              setProfile(null);
            }
          }
        )
        .subscribe((status) => {
          console.log('[useProfile] Realtime status:', status);
        });
    };

    init();

    // Cleanup al desmontar
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return {
    profile,
    loading,
    error,
    refetch
  };
}
