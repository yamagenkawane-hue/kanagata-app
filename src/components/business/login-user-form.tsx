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
      const response = await fetch("/api/auth/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: form.get("userId"), name: form.get("name"), password: form.get("password"), role: initial ? "admin" : form.get("role"), expected: revision, initial }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "登録できませんでした");
      formElement.reset(); setDone(true); onSaved?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "接続できませんでした"); }
    finally { setBusy(false); }
  }
  if (done) return <div role="status"><p>ログインユーザーを登録しました。</p><Link className="button primary" href="/login">ログイン画面へ</Link></div>;
  return <><p className="help-text">{initial ? "最初に1回だけ登録してください。" : "作成したユーザーID・パスワードでシステムへログインできます。"}</p>{error && <div className="inline-error" role="alert">{error}</div>}<form onSubmit={submit}>
    <label>表示名<input name="name" required maxLength={120} autoComplete="name" /></label>
    <label>ユーザーID<input name="userId" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*" autoCapitalize="none" spellCheck={false} autoComplete="off" placeholder="例：yamada（半角英数字）" /></label>
    <label>パスワード（8文字以上）<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
    <label>パスワードの確認<input name="confirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
    {!initial && <label>権限<select name="role" defaultValue="operator"><option value="operator">担当者</option><option value="admin">管理者</option></select></label>}
    <button className="button primary full-width" disabled={busy}>{busy ? "登録中…" : initial ? "管理者を登録" : "ログインユーザーを登録"}</button>
  </form></>;
}
