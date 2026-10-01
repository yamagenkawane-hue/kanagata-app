import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { loginEmail, userIdSchema } from "@/domain/login-user";
import { sameOrigin, boundedBody } from "@/lib/business/http";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "許可されていない要求です。" }, { status: 403 });
    if (!supabaseConfig()) return NextResponse.json({ error: "SupabaseのURLとPublishable keyを.env.localに設定してください。" }, { status: 503 });
    const body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096)));
    const userId = userIdSchema.safeParse(body?.userId);
    if (!userId.success || typeof body.password !== "string" || !body.password || body.password.length > 1024) return NextResponse.json({ error: "ユーザーIDとパスワードを確認してください。" }, { status: 400 });
    const client = await createSupabaseServer(true);
    const { error } = await client.auth.signInWithPassword({ email: loginEmail(userId.data), password: body.password });
    if (error) return NextResponse.json({ error: "ログインできませんでした。入力内容とアカウント登録を確認してください。" }, { status: 401 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "ログイン処理に失敗しました。接続設定を確認してください。" }, { status: 500 }); }
}

