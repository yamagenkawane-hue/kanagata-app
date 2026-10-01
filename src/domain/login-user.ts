import { z } from "zod";

export const userIdSchema = z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9][a-z0-9_-]*$/, "ユーザーIDは半角英数字・ハイフン・アンダースコアで入力してください");

// Supabase Authのメール認証を内部識別子として使う。メール送信には使用しない。
export function loginEmail(userId: string): string {
  return `${userIdSchema.parse(userId)}@users.kanagata.invalid`;
}

export const loginUserSchema = z.object({
  userId: userIdSchema,
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12, "パスワードは12文字以上で入力してください").max(128),
  role: z.enum(["admin", "operator"]),
  expected: z.number().int().positive().optional(),
  initial: z.boolean().default(false),
});
