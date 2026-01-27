import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();
    const rutRaw = String(body?.rut || "").trim();
    const password = String(body?.password || "");

    if (!rutRaw || !password) {
      return NextResponse.json(
        { message: "Credenciales inválidas." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { message: "Config Supabase incompleta en el servidor." },
        { status: 500 }
      );
    }

    // Normaliza rut tipo 12345678-9 (sin puntos)
    const rut = rutRaw.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
    const rutNormalized =
      rut.includes("-") || rut.length < 2
        ? rut
        : `${rut.slice(0, -1)}-${rut.slice(-1)}`;

    // 1) Resolver email desde profiles usando Service Role (NO RLS)
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("email, is_blocked")
      .eq("rut", rutNormalized)
      .single();

    if (profErr || !profile?.email) {
      return NextResponse.json(
        { message: "Credenciales inválidas." },
        { status: 401 }
      );
    }

    if (profile?.is_blocked) {
      return NextResponse.json(
        { message: "Tu cuenta está bloqueada. Contacta soporte." },
        { status: 403 }
      );
    }

    const email = String(profile.email).trim().toLowerCase();

    // 2) Login real contra Supabase Auth (password grant)
    const resp = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    const json = await resp.json();

    if (!resp.ok) {
      const msg = String(json?.error_description || json?.msg || "").toLowerCase();

      if (msg.includes("email not confirmed")) {
        return NextResponse.json(
          { message: "Debes confirmar tu correo antes de iniciar sesión." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { message: "RUT/correo o contraseña incorrectos." },
        { status: 401 }
      );
    }

    // json trae: access_token, refresh_token, user, expires_in, token_type
    return NextResponse.json(json, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Ocurrió un error al iniciar sesión." },
      { status: 500 }
    );
  }
}
