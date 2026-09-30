import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    if (!request.headers.get("origin") || new URL(request.headers.get("origin")!).host !== request.headers.get("host") || new URL(request.headers.get("origin")!).protocol !== new URL(request.url).protocol) return NextResponse.json({ error: "許可されていない要求です。" }, { status: 403 });
    const client = await createSupabaseServer(true); const { error } = await client.auth.signOut();
    if (error) return NextResponse.json({ error: "ログアウトに失敗しました。" }, { status: 500 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "ログアウトに失敗しました。" }, { status: 500 }); }
}

