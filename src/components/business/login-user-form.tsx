"use client";
import { useState } from "react";
import Link from "next/link";

export default function LoginUserForm({ initial = false, revision, onSaved }: { initial?: boolean; revision?: number; onSaved?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("password") !== form.get("confirmation")) { setError("確認用パスワードが一致しません"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), name: form.get("name"), password: form.get("password"), role: initial ? "admin" : form.get("role"), expected: revision, ...(initial ? { setupToken: form.get("setupToken") } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "登録できませんでした");
      formElement.reset(); setDone(true); onSaved?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "接続できませんでした"); }
    finally { setBusy(false); }
  }
  if (done) return <div role="status"><p>ログインユーザーを登録しました。</p><Link className="button primary" href="/login">ログイン画面へ</Link></div>;
  return <><p className="help-text">{initial ? "最初の管理者を登録します。登録後、この初期設定は使えなくなります。" : "作成したメール・パスワードでシステムへログインできます。"}</p>{error && <div className="inline-error" role="alert">{error}</div>}<form onSubmit={submit}>
    {initial && <label>初回登録用の合言葉<input name="setupToken" type="password" required maxLength={256} autoComplete="off" /></label>}
    <label>表示名<input name="name" required maxLength={120} autoComplete="name" /></label>
    <label>メールアドレス<input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
    <label>パスワード（12文字以上）<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    <label>パスワードの確認<input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    {!initial && <label>権限<select name="role" defaultValue="operator"><option value="operator">担当者</option><option value="admin">管理者</option></select></label>}
    <button className="button primary full-width" disabled={busy}>{busy ? "登録中…" : initial ? "管理者を登録" : "ログインユーザーを登録"}</button>
  </form></>;
}
