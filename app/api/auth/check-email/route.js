import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidEmail } from "@/lib/validations";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({ exists: Boolean(data?.id) });
  } catch (error) {
    return NextResponse.json(
      { error: "CHECK_EMAIL_FAILED", message: error?.message || "No se pudo verificar el correo." },
      { status: 500 }
    );
  }
}
