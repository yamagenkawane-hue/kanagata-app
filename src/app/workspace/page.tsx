import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  if (!supabaseConfig()) redirect("/login");
  const client = await createSupabaseServer();
  let user;
  try { const result = await client.auth.getUser(); user = result.data.user; } catch { redirect("/login"); }
  if (!user) redirect("/login");
  const profile = await client.from("profiles").select("display_name,role,is_active").eq("user_id", user.id).maybeSingle();
  const ready = !profile.error && profile.data?.is_active;
  return <main className="login-screen"><section className="login-card workspace-card"><div className="eyebrow">CONNECTION STATUS</div><h1>接続・アカウント確認</h1>{ready && profile.data ? <><p className="connection-success">✓ 認証とアカウントの権限を確認できました。</p><p>{profile.data.display_name} / {profile.data.role === "admin" ? "管理者" : "工程担当者"}</p><p className="help-text">業務テーブルへの保存APIは接続後の実装・結合検証が必要です。現在のガントはデモモードです。</p></> : <div className="inline-error">{profile.error ? "ログインは成功しました。業務テーブルのSQLを適用し、profilesを登録してください。" : "ログインは成功しましたが、有効な業務アカウントが未登録です。管理者へ確認してください。"}</div>}<Link className="demo-link" href="/planning">デモの生産計画を確認する →</Link><LogoutButton /></section></main>;
}

