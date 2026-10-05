import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("BOM categories preserve old items and enforce role, type, stopped selection and revisions", async () => {
  const db = new PGlite();
  const admin = "11111111-1111-4111-8111-111111111111", operator = "22222222-2222-4222-8222-222222222222";
  const product = "33333333-3333-4333-8333-333333333333", category = "44444444-4444-4444-8444-444444444444", bom = "55555555-5555-4555-8555-555555555555";
  try {
    await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
    for (const file of ["202609300001_initial_schema.sql","202610010001_bom_and_mutations.sql"]) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),"utf8"));
    await db.query("insert into auth.users values($1),($2)",[admin,operator]);
    await db.query("insert into public.profiles(user_id,display_name,role) values($1,'管理者','admin'),($2,'担当者','operator')",[admin,operator]);
    await db.query("insert into public.products(id,name,due_date) values($1,'金型','2026-10-30')",[product]);
    await db.query("insert into public.bom_items(product_id,name,kind,quantity,processes) values($1,'既存部品','part',1,array['wire'])",[product]);
    await db.exec(await readFile(new URL("../../supabase/migrations/202610050001_bom_categories.sql",import.meta.url),"utf8"));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
    const read = async () => (await db.query<{value:{revision:number;categories:{id:string;name:string}[];bom:{id:string;categoryId:string;kind:string}[]}}>("select public.read_planning() as value")).rows[0].value;
    const save = async (entity:string,payload:unknown,revision?:number) => db.query("select public.manage_entity($1,$2,$3)",[entity,JSON.stringify(payload),revision??(await read()).revision]);
    assert.ok((await read()).bom[0].categoryId);
    await save("category",{id:category,name:"購入品",kind:"part",active:true});
    assert.equal((await read()).categories.length,3);
    const item={id:bom,productId:product,categoryId:category,name:"部品",kind:"plate",quantity:1,notes:"",processes:["wire"],archived:false};
    await save("bom",item);
    assert.equal((await read()).bom.find(x=>x.id===bom)?.kind,"part");
    await assert.rejects(save("category",{id:category,name:"購入品",kind:"plate",active:true}),/型は変更できません/);
    await save("category",{id:category,name:"購入部品",kind:"part",active:false});
    await save("bom",{...item,name:"既存を編集"});
    await assert.rejects(save("bom",{...item,id:"66666666-6666-4666-8666-666666666666"}),/停止中/);
    await assert.rejects(save("category",{name:"購入部品",kind:"part",active:true}),/unique/);
    await assert.rejects(save("category",{name:"追加",kind:"part",active:true},1),/他の利用者/);
    await db.exec(`set request.jwt.claim.sub='${operator}'`);
    await assert.rejects(save("category",{name:"担当者から追加",kind:"part",active:true}),/管理者のみ/);
    await assert.rejects(db.query("select public.manage_entity_before_categories('category','{}',1)"),/permission denied/);
    await db.exec("set role anon");
    await assert.rejects(db.query("select public.read_planning()"),/permission denied/);
  } finally { await db.close(); }
});
