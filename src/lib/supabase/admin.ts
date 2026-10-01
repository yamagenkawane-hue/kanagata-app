import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function createSupabaseAdmin() {
  const config = supabaseConfig();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!config || !key) throw new Error("サーバー専用のSUPABASE_SECRET_KEYを.env.localに設定してください");
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
