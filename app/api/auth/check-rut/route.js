import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimitByRequest } from "@/lib/security/rateLimit";

export async function POST(request) {
  try {
    const rate = rateLimitByRequest(request, {
      bucket: "auth-check-rut",
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." },
        { status: 429 }
      );
    }

    const { rut } = await request.json();
    const cleanRut = String(rut || "").trim();
    if (!cleanRut) {
      return NextResponse.json({ error: "RUT requerido" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("rut", cleanRut)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({ exists: Boolean(data?.id) });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Error validando RUT" }, { status: 500 });
  }
}
