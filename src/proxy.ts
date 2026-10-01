import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  if (!config) return NextResponse.next();
  let response = NextResponse.next({ request });
  try {
    const client = createServerClient(config.url, config.key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      },
    }});
    await client.auth.getClaims();
  } catch {
    // 認証と役割の最終確認は各ページ・APIで行い、認証障害時に業務データを返さない。
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/login", "/workspace/:path*", "/api/auth/:path*", "/api/connection", "/api/business", "/api/calendar-import"] };
