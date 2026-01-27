// app/api/tickets/my-publications/route.js
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { buildTicketSelect, normalizeTicket } from "@/lib/db/ticketSchema";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // ✅ IMPORTANTE: Traemos también ticket_uploads
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        ${buildTicketSelect()},
        ticket_upload:ticket_uploads (
          id,
          is_nominated,
          is_nominada,
          provider,
          storage_bucket,
          storage_path,
          original_name,
          file_size,
          mime_type,
          validation_status
        )
      `)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // ✅ normalizeTicket ahora debe dejar pasar ticket_upload
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
