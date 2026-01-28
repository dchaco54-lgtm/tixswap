// app/api/tickets/my-publications/route.js
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";
import { supabaseServiceOptional } from "@/lib/supabaseServiceOptional";

function computeSummary(list) {
  const summary = { total: list.length, active: 0, paused: 0, sold: 0 };
  for (const t of list) {
    const status = (t?.status || "").toLowerCase();
    if (status === "active") summary.active += 1;
    else if (status === "paused") summary.paused += 1;
    else if (status === "sold") summary.sold += 1;
  }
  return summary;
}

function getEnvErrorResponse() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }
  return null;
}

export async function GET(request) {
  try {
    const envError = getEnvErrorResponse();
    if (envError) return envError;

    const authHeader = request.headers.get("authorization");
    const supabaseAuth = createRouteHandlerClient({ cookies });
    let user = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const service = supabaseServiceOptional();
      const authDb = service || supabaseAuth;
      const { data: authData, error: authErr } = await authDb.auth.getUser(token);
      if (authErr || !authData?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      user = authData.user;
    } else {
      const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
      if (authErr || !authData?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      user = authData.user;
    }

    const service = supabaseServiceOptional();
    const db = service || supabaseAuth;

    const columns = await detectTicketColumns(db);
    const selectStr = buildTicketSelect(columns);

    const { data: ticketRows, error: ticketsErr } = await db
      .from("tickets")
      .select(selectStr)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (ticketsErr) {
      return NextResponse.json(
        { error: "Error loading publications", details: ticketsErr.message },
        { status: 500 }
      );
    }

    const uploadIds = Array.from(
      new Set(
        (ticketRows || [])
          .map((t) => t.ticket_upload_id || t.ticket_uploads_id || null)
          .filter(Boolean)
      )
    );

    let uploadsMap = {};
    if (uploadIds.length) {
      const { data: uploads, error: uploadsErr } = await db
        .from("ticket_uploads")
        .select(
          "id,is_nominated,is_nominada,provider,storage_bucket,storage_path,original_name,mime_type,file_size,validation_status,status,created_at"
        )
        .in("id", uploadIds);

      if (uploadsErr) {
        console.error("[my-publications] ticket_uploads query error:", uploadsErr);
      } else {
        uploadsMap = Object.fromEntries((uploads || []).map((u) => [u.id, u]));
      }
    }

    const tickets = (ticketRows || []).map((t) => {
      const uploadId = t.ticket_upload_id || t.ticket_uploads_id || null;
      const withUpload = { ...t, ticket_upload: uploadsMap[uploadId] ?? null };
      return normalizeTicket(withUpload);
    });
    const summary = computeSummary(tickets);

    return NextResponse.json({ tickets, summary }, { status: 200 });
  } catch (err) {
    console.error("my-publications error:", err);
    return NextResponse.json(
      { error: err.message || "Error loading publications" },
      { status: 500 }
    );
  }
}
