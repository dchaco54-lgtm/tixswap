"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import {
  getMissingRequiredProfileFields,
  isProfileReadyForSensitiveActions,
} from "@/lib/profileCompletion";

function buildFallbackProfile(user, profile) {
  if (profile) return profile;
  if (!user) return null;

  return {
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
}

export function useSensitiveActionGuard({ defaultRedirectTo = "/dashboard" } = {}) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState({
    open: false,
    actionLabel: "",
    allowClose: false,
  });
  const pendingActionRef = useRef(null);

  async function ensureProfileContext() {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return { user: null, profile: null };
    }

    setUser(authUser);

    let profileRow = null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!error) {
      profileRow = data || null;
    }

    if (!profileRow) {
      try {
        const response = await fetch("/api/profile/ensure", { method: "POST" });
        const json = await response.json().catch(() => ({}));
        if (response.ok) {
          profileRow = json.profile || null;
        }
      } catch {
        profileRow = null;
      }
    }

    const nextProfile = buildFallbackProfile(authUser, profileRow);
    setProfile(nextProfile);
    setLoading(false);

    return {
      user: authUser,
      profile: nextProfile,
    };
  }

  useEffect(() => {
    ensureProfileContext();
  }, []);

  async function ensureAccess({
    actionLabel,
    onAllowed,
    redirectTo,
    allowClose = false,
  }) {
    setLoading(true);
    const context = await ensureProfileContext();

    if (!context.user) {
      const nextRedirect =
        redirectTo ||
        defaultRedirectTo ||
        (typeof window !== "undefined" ? window.location.pathname : "/dashboard");
      router.push(`/login?redirectTo=${encodeURIComponent(nextRedirect)}`);
      return false;
    }

    if (!isProfileReadyForSensitiveActions(context.profile)) {
      pendingActionRef.current =
        typeof onAllowed === "function" ? onAllowed : null;
      setModalState({
        open: true,
        actionLabel: actionLabel || "continuar",
        allowClose,
      });
      return false;
    }

    if (typeof onAllowed === "function") {
      await onAllowed();
    }

    return true;
  }

  function openGuard(actionLabel, allowClose = false) {
    pendingActionRef.current = null;
    setModalState({
      open: true,
      actionLabel: actionLabel || "continuar",
      allowClose,
    });
  }

  function closeGuard() {
    if (!modalState.allowClose) return;
    pendingActionRef.current = null;
    setModalState((current) => ({ ...current, open: false }));
  }

  async function handleCompleted(nextProfile) {
    const safeProfile = nextProfile || profile;
    setProfile(safeProfile);
    setModalState({
      open: false,
      actionLabel: "",
      allowClose: false,
    });

    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;

    if (typeof pendingAction === "function") {
      await pendingAction();
    }
  }

  return {
    user,
    profile,
    setProfile,
    loading,
    missingFields: getMissingRequiredProfileFields(profile),
    needsProfileCompletion: !isProfileReadyForSensitiveActions(profile),
    modalState,
    ensureAccess,
    openGuard,
    closeGuard,
    handleCompleted,
  };
}
