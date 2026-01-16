import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    const missing = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL)");
    if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    throw new Error(`Supabase Admin Client not configured. Missing: ${missing.join(", ")}`);
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Query simple y directo: solo tickets activos
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    console.log('[API Tickets] Query result:', { 
      eventId: id, 
      ticketCount: data?.length,
      error: error?.message 
    });

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: error.hint, details: error.details, code: error.code },
        { 
          status: 500,
          headers: {
            'Cache-Control': 'no-store, must-revalidate, max-age=0',
            'CDN-Cache-Control': 'no-store'
          }
        }
      );
    }

    return NextResponse.json(
      { tickets: data || [] }, 
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate, max-age=0',
          'CDN-Cache-Control': 'no-store'
        }
      }
    );
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}

