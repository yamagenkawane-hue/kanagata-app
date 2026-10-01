import { z } from "zod";

export const loginUserSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12, "パスワードは12文字以上で入力してください").max(128),
  role: z.enum(["admin", "operator"]),
  expected: z.number().int().positive().optional(),
  setupToken: z.string().max(256).optional(),
});
