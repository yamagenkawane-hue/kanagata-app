import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { loginUserSchema, loginEmail } from "../../src/domain/login-user.ts";

test("login user validates user ID, role and password without trimming password", () => {
  const input = { userId: " Yamada_01 ", name: " 利用者 ", password: " abcdefghijk ", role: "operator" };
  const parsed = loginUserSchema.parse(input);
  assert.equal(parsed.password, input.password);
  assert.equal(parsed.userId, "yamada_01");
  assert.equal(loginEmail(parsed.userId), "yamada_01@users.kanagata.invalid");
  assert.equal(parsed.name, "利用者");
  assert.equal(loginUserSchema.safeParse({ ...input, password: "12345678" }).success, true);
  assert.equal(loginUserSchema.safeParse({ ...input, password: "1234567" }).success, false);
  for (const invalid of [{ password: "short" }, { userId: "user@example.com" }, { userId: "山田" }, { userId: "ab" }, { role: "owner" }, { name: " " }]) assert.equal(loginUserSchema.safeParse({ ...input, ...invalid }).success, false);
});

test("login profile RPC permits one bootstrap, restricts service access and checks administrator/revision", async () => {
  const db = new PGlite();
  const first = "11111111-1111-4111-8111-111111111111", second = "22222222-2222-4222-8222-222222222222", third = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
    for (const file of ["202609300001_initial_schema.sql", "202610010001_bom_and_mutations.sql", "202610010002_login_users.sql"]) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
    await db.query("insert into auth.users values($1),($2),($3)", [first, second, third]);
    const register = (user: string, actor: string | null, role: string, expected: number | null) => db.query("select public.register_login_profile($1,$2,'利用者',$3,$4)", [user, actor, role, expected]);
    await db.exec("set role anon");
    await assert.rejects(register(first, null, "admin", null), /permission denied/);
    await db.exec("set role authenticated");
    await assert.rejects(register(first, null, "admin", null), /permission denied/);
    await db.exec("set role service_role");
    await assert.rejects(register(first, null, "operator", null), /最初の利用者/);
    await register(first, null, "admin", null);
    await assert.rejects(register(second, null, "admin", null), /初回登録は完了/);
    await assert.rejects(register(second, first, "operator", 1), /他の利用者/);
    await register(second, first, "operator", 2);
    await assert.rejects(register(third, second, "admin", 3), /管理者のみ/);
    await register(third, first, "admin", 3);
    await db.exec("reset role");
    const count = await db.query<{ count: number }>("select count(*)::integer as count from public.profiles");
    assert.equal(count.rows[0].count, 3);
    const audits = await db.query<{ count: number }>("select count(*)::integer as count from public.change_logs where entity_type='login_user'");
    assert.equal(audits.rows[0].count, 3);
  } finally { await db.close(); }
});
