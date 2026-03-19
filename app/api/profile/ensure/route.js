import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildProfileGatePayload,
  syncProfileFromAuthUser,
} from "@/lib/profileCompletionServer";

export const dynamic = "force-dynamic";

async function handleEnsureProfile() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const profile = await syncProfileFromAuthUser(admin, user);

  return NextResponse.json({
    profile,
    ...buildProfileGatePayload(profile),
  });
}

export async function GET() {
  try {
    return await handleEnsureProfile();
  } catch (error) {
    console.error("[Profile Ensure][GET]", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo preparar el perfil." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    return await handleEnsureProfile();
  } catch (error) {
    console.error("[Profile Ensure][POST]", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo preparar el perfil." },
      { status: 500 }
    );
  }
}
