import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sha = (searchParams.get("sha") || "").trim();

    if (!sha || sha.length < 32) {
      return NextResponse.json({ error: "sha inválido" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("ticket_files")
      .select("id")
      .eq("sha256", sha)
      .limit(1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ exists: (data || []).length > 0 });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
