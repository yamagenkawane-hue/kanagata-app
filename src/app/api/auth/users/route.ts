import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { businessContext, BusinessError } from "@/lib/business/server";
import { boundedBody, sameOrigin } from "@/lib/business/http";
import { loginUserSchema, loginEmail } from "@/domain/login-user";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new BusinessError("許可されていない要求です", 403);
    const parsed = loginUserSchema.safeParse(JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096))));
    if (!parsed.success) throw new BusinessError("ユーザーID（半角英数字・_・-、3〜32文字）・表示名・12文字以上のパスワードを確認してください");
    const input = parsed.data;
    let actor: string | null = null;
    if (input.setupToken !== undefined) {
      const token = process.env.INITIAL_ADMIN_SETUP_TOKEN;
      if (!token || token.length < 24) throw new BusinessError("初回登録用の合言葉をサーバーに設定してください（24文字以上）", 503);
      const digest = (value: string) => createHash("sha256").update(value).digest();
      if (!timingSafeEqual(digest(token), digest(input.setupToken))) throw new BusinessError("合言葉を確認してください", 403);
      if (input.role !== "admin") throw new BusinessError("最初の利用者は管理者です");
    } else {
      const context = await businessContext();
      if (context.role !== "admin") throw new BusinessError("管理者のみ登録できます", 403);
      actor = context.userId;
      if (!input.expected) throw new BusinessError("画面を再読み込みしてください");
    }
    const admin = createSupabaseAdmin();
    if (!actor) {
      const check = await admin.from("profiles").select("user_id").limit(1);
      if (check.error) throw new BusinessError("初期SQLを適用してください", 503);
      if (check.data.length) throw new BusinessError("初回登録は完了しています。管理者でログインしてください", 409);
    }
    const created = await admin.auth.admin.createUser({ email: loginEmail(input.userId), password: input.password, email_confirm: true, app_metadata: { login_user_id: input.userId } });
    if (created.error || !created.data.user) throw new BusinessError("ユーザーを作成できませんでした。ユーザーIDの重複とパスワード条件を確認してください");
    const saved = await admin.rpc("register_login_profile", { new_user: created.data.user.id, actor, display_name: input.name, new_role: input.role, expected: input.expected ?? null });
    if (saved.error) {
      const rollback = await admin.auth.admin.deleteUser(created.data.user.id);
      if (rollback.error) throw new BusinessError("プロフィール登録に失敗しました。作成されたAuthアカウントの確認が必要です", 503);
      throw new BusinessError(saved.error.code === "40001" ? "他の利用者が更新しました。再読み込みしてください" : "利用者登録に失敗しました。追加SQLの適用と初回登録状態を確認してください", saved.error.code === "40001" ? 409 : 400);
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const status = cause instanceof BusinessError ? cause.status : cause instanceof SyntaxError ? 400 : 503;
    return NextResponse.json({ error: cause instanceof BusinessError ? cause.message : "登録に失敗しました。サーバー専用キーと追加SQLを確認してください" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
