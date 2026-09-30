import { NextResponse } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer } from "@/lib/supabase/server";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!supabaseConfig()) return NextResponse.json({ configured: false, message: "URLまたはPublishable keyが未設定です。" }, { headers });
  try {
    const client = await createSupabaseServer(); const { data, error } = await client.auth.getUser();
    if (error || !data.user) return NextResponse.json({ configured: true, authenticated: false }, { status: 401, headers });
    const result = await client.from("profiles").select("role,is_active").eq("user_id", data.user.id).maybeSingle();
    if (result.error) return NextResponse.json({ configured: true, authenticated: true, databaseReady: false, message: "テーブルの作成とRLS設定を確認してください。" }, { headers });
    if (!result.data?.is_active) return NextResponse.json({ configured: true, authenticated: true, databaseReady: true, authorized: false }, { status: 403, headers });
    return NextResponse.json({ configured: true, authenticated: true, databaseReady: true, role: result.data.role }, { headers });
  } catch { return NextResponse.json({ message: "Supabaseに接続できません。" }, { status: 503, headers }); }
}
