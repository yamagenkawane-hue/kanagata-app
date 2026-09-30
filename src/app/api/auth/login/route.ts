import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export async function POST(request: Request) {
  try {
    if (!request.headers.get("origin") || new URL(request.headers.get("origin")!).host !== request.headers.get("host") || new URL(request.headers.get("origin")!).protocol !== new URL(request.url).protocol) return NextResponse.json({ error: "許可されていない要求です。" }, { status: 403 });
    if (!supabaseConfig()) return NextResponse.json({ error: "SupabaseのURLとPublishable keyを.env.localに設定してください。" }, { status: 503 });
    const body = await request.json();
    if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || typeof body.password !== "string" || !body.password || body.password.length > 1024) return NextResponse.json({ error: "メールアドレスとパスワードを確認してください。" }, { status: 400 });
    const client = await createSupabaseServer(true);
    const { error } = await client.auth.signInWithPassword({ email: body.email.trim(), password: body.password });
    if (error) return NextResponse.json({ error: "ログインできませんでした。入力内容とアカウント登録を確認してください。" }, { status: 401 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "ログイン処理に失敗しました。接続設定を確認してください。" }, { status: 500 }); }
}

