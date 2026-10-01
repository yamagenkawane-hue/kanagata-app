"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ログインに失敗しました。");
      router.push("/workspace"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "接続できませんでした。"); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><section className="login-card"><div className="login-logo">▦ KPLAN</div><div className="eyebrow">PRODUCTION MANAGEMENT</div><h1>生産管理システム</h1><p className="help-text">登録済みの個人アカウントでログインしてください。</p>{!configured && <div className="inline-error">接続設定が未完了です。.env.localのPublishable keyを設定してください。</div>}{error && <div className="inline-error" role="alert">{error}</div>}<form onSubmit={submit}><label>メールアドレス<input type="email" name="email" autoComplete="username" required maxLength={254} /></label><label>パスワード<input type="password" name="password" autoComplete="current-password" required maxLength={1024} /></label><button type="submit" className="button primary full-width" disabled={!configured || busy}>{busy ? "ログイン中…" : "ログイン"}</button></form><Link className="demo-link" href="/demo">画面確認用のデモを開く →</Link><Link className="demo-link" href="/setup">初めて使う方：管理者を登録 →</Link><p className="help-text">追加ユーザーは管理者がユーザー設定から登録します。</p></section></main>;
}
