import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateProfileCompletionData } from "@/lib/profileCompletion";
import {
  buildProfileGatePayload,
  syncProfileFromAuthUser,
} from "@/lib/profileCompletionServer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const validation = validateProfileCompletionData(body);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    await syncProfileFromAuthUser(admin, user);

    const { data: duplicateRut, error: duplicateError } = await admin
      .from("profiles")
      .select("id")
      .eq("rut", validation.normalized.rut)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (duplicateError && duplicateError.code !== "PGRST116") {
      throw duplicateError;
    }

    if (duplicateRut?.id) {
      return NextResponse.json(
        {
          error: "RUT_ALREADY_REGISTERED",
          errors: {
            rut: "Ese RUT ya está registrado en otra cuenta.",
          },
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const payload = {
      full_name: validation.normalized.full_name,
      rut: validation.normalized.rut,
      phone: validation.normalized.phone,
      email: user.email || null,
      email_confirmed: Boolean(user?.email_confirmed_at || user?.confirmed_at),
      onboarding_completed: true,
      onboarding_done: true,
      onboarding_completed_at: now,
      onboarding_dismissed_at: null,
    };

    const { data: profile, error: updateError } = await admin
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      profile,
      ...buildProfileGatePayload(profile),
    });
  } catch (error) {
    console.error("[Profile Complete][POST]", error);
    return NextResponse.json(
      { error: error?.message || "No se pudieron guardar los datos." },
      { status: 500 }
    );
  }
}
