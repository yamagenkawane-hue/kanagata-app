"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function LogoutButton() {
  const [error, setError] = useState(""); const router = useRouter();
  async function logout() {
    try { const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw new Error("ログアウトに失敗しました。"); router.push("/login"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "処理に失敗しました。"); }
  }
  return <><button className="button" onClick={logout}>ログアウト</button>{error && <p role="alert">{error}</p>}</>;
}
