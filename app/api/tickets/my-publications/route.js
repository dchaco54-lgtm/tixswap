// app/api/tickets/my-publications/route.js
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";

function getAdminOrResponse() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      error: NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 }),
    };
  }

  return {
    admin: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    }),
  };
}

export async function GET(request) {
  try {
    const { admin, error } = getAdminOrResponse();
    if (error) return error;

    const authHeader = request.headers.get("authorization");
    let user = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: authData, error: authErr } = await admin.auth.getUser(token);
      if (authErr || !authData?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      user = authData.user;
    } else {
      const supabase = createRouteHandlerClient({ cookies });
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      user = authData.user;
    }

    const columns = await detectTicketColumns(admin);
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
    const { data: dataWithUpload, error: withUploadErr } = await admin
      .from("tickets")
      .select(selectWithUpload)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (withUploadErr) {
      console.error("[my-publications] embed ticket_uploads error:", withUploadErr);
      const { data: fallbackData, error: fallbackErr } = await admin
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
    const summary = {
      total: tickets.length,
      active: tickets.filter((t) => t.status === "active").length,
      paused: tickets.filter((t) => t.status === "paused").length,
      sold: tickets.filter((t) => t.status === "sold").length,
    };

    return NextResponse.json({ tickets, summary }, { status: 200 });
  } catch (err) {
    console.error("my-publications error:", err);
    return NextResponse.json(
      { error: err.message || "Error loading publications" },
      { status: 500 }
    );
  }
}
