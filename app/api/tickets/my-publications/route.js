// app/api/tickets/my-publications/route.js
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const columns = await detectTicketColumns(supabase);
    const baseSelect = buildTicketSelect(columns);
    const selectWithUpload = `${baseSelect}, ticket_upload:ticket_uploads (
      id,
      is_nominated,
      is_nominada,
      provider,
      storage_bucket,
      storage_path,
      original_name,
      file_size,
      mime_type,
      validation_status,
      status
    )`;

    let data = null;
    const { data: dataWithUpload, error: withUploadErr } = await supabase
      .from("tickets")
      .select(selectWithUpload)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (withUploadErr) {
      console.error("[my-publications] embed ticket_uploads error:", withUploadErr);
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from("tickets")
        .select(baseSelect)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (fallbackErr) throw fallbackErr;
      data = fallbackData;
    } else {
      data = dataWithUpload;
    }

    const tickets = (data || []).map((t) => normalizeTicket(t));

    return NextResponse.json({ tickets }, { status: 200 });
  } catch (err) {
    console.error("my-publications error:", err);
    return NextResponse.json(
      { error: err.message || "Error loading publications" },
      { status: 500 }
    );
  }
}
