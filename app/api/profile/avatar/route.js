import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";

function getSessionClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env missing");

  const projectRef = supabaseUrl?.split("https://")[1]?.split(".")[0];
  const tokenCookie = cookies().get(`sb-${projectRef}-auth-token`)?.value;

  let accessToken;
  try {
    accessToken = tokenCookie ? JSON.parse(tokenCookie)?.access_token : undefined;
  } catch (e) {
    accessToken = undefined;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });

  return supabase;
}

export async function POST(request) {
  try {
    const supabase = getSessionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "Solo imágenes" }, { status: 400 });
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "El archivo debe pesar menos de 2MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name?.split(".").pop() || "bin";
    const fileName = `${user.id}-${Date.now()}.${ext}`;
    const path = `${user.id}/${fileName}`;

    const admin = supabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = admin.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: publicData?.publicUrl })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, avatarUrl: publicData?.publicUrl });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Error subiendo avatar" }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const supabase = getSessionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: files, error: listError } = await admin.storage
      .from("avatars")
      .list(`${user.id}`);

    if (listError) throw listError;

    if (files?.length) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      const { error: delError } = await admin.storage.from("avatars").remove(paths);
      if (delError) throw delError;
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Error eliminando avatar" }, { status: 400 });
  }
}
