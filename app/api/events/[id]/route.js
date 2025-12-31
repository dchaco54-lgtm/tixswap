import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: event, error } = await admin
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 404 }
      );
    }

    return NextResponse.json({ event }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "Error interno", details: String(e) },
      { status: 500 }
    );
  }
}
