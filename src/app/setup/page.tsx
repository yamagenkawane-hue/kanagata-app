import Link from "next/link";
import LoginUserForm from "@/components/business/login-user-form";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function SetupPage() {
  let message = "";
  try {
    const admin = createSupabaseAdmin();
    const result = await admin.from("profiles").select("user_id").limit(1);
    if (result.error) message = "初期SQLを適用してください。";
    else if (result.data.length) message = "初回登録は完了しています。管理者でログインしてください。";
  } catch { message = "サーバー専用のSUPABASE_SECRET_KEYを.env.localに設定して再起動してください。"; }
  return <main className="login-screen"><section className="login-card"><div className="login-logo">▦ KPLAN</div><h1>初期ユーザー設定</h1>{message ? <p role="status">{message}</p> : <LoginUserForm initial />}<Link className="demo-link" href="/login">ログイン画面へ戻る</Link></section></main>;
}
