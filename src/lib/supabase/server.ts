import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
export async function createSupabaseServer(writable = false) {
  const config = supabaseConfig();
  if (!config) throw new Error("SupabaseのURLとPublishable keyを.env.localに設定してください。");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        if (!writable) return; // Server ComponentsではProxyが更新したCookieを使用する。
        for (const { name, value, options } of items) store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      },
    },
  });
}
