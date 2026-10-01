"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: form.get("userId"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ログインに失敗しました。");
      router.push("/workspace"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "接続できませんでした。"); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><section className="login-card simple-login">
    <h1>生産管理 ログイン</h1>
    {!configured && <div className="inline-error">接続設定が未完了です。管理者に確認してください。</div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <label>ユーザーID<input name="userId" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="例：yamada" required minLength={3} maxLength={32} /></label>
      <label>パスワード<input type="password" name="password" autoComplete="current-password" required maxLength={1024} /></label>
      <button type="submit" className="button primary full-width" disabled={!configured || busy}>{busy ? "ログイン中…" : "ログイン"}</button>
    </form>
    <Link className="demo-link" href="/setup">初回のみ：管理者を登録</Link>
  </section></main>;
}
