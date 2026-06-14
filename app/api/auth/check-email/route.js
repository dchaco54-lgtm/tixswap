import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidEmail } from "@/lib/validations";
import { rateLimitByRequest } from "@/lib/security/rateLimit";

export async function POST(req) {
  const rate = rateLimitByRequest(req, {
    bucket: "auth-check-email",
    limit: 20,
    windowMs: 5 * 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  try {
    const admin = supabaseAdmin();

    // Query auth.users directly — catches users whose profile row was never created
    const { data, error } = await admin
      .schema("auth")
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    return NextResponse.json({ exists: Boolean(data?.id) });
  } catch (error) {
    return NextResponse.json(
      { error: "CHECK_EMAIL_FAILED", message: error?.message || "No se pudo verificar el correo." },
      { status: 500 }
    );
  }
}
