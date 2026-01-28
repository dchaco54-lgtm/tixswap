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
    const selectStr = buildTicketSelect(columns);

    const { data, error } = await supabase
      .from("tickets")
      .select(selectStr)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const uploadIds = Array.from(
      new Set(
        (data || [])
          .map((t) => t.ticket_upload_id || t.ticket_uploads_id || null)
          .filter(Boolean)
      )
    );

    let uploadsMap = {};
    if (uploadIds.length) {
      const { data: uploads, error: uploadsErr } = await supabase
        .from("ticket_uploads")
        .select(
          "id,is_nominated,is_nominada,provider,storage_bucket,storage_path,original_name,mime_type,file_size,validation_status,validation_reason,status,created_at"
        )
        .in("id", uploadIds);

      if (uploadsErr) throw uploadsErr;
      uploadsMap = Object.fromEntries((uploads || []).map((u) => [u.id, u]));
    }

    const tickets = (data || []).map((t) => {
      const uploadId = t.ticket_upload_id || t.ticket_uploads_id || null;
      const withUpload = { ...t, ticket_upload: uploadsMap[uploadId] ?? null };
      return normalizeTicket(withUpload, columns);
    });

    return NextResponse.json({ tickets }, { status: 200 });
  } catch (err) {
    console.error("my-publications error:", err);
    return NextResponse.json(
      { error: err.message || "Error loading publications" },
      { status: 500 }
    );
  }
}
