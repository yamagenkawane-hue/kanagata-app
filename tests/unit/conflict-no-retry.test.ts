import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("revision conflicts return non-retryable PT409 and keep authorization, revision and rollback intact",async()=>{
 const db=new PGlite();const admin=randomUUID(),operator=randomUUID();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
  for(const file of ["202609300001_initial_schema.sql","202610010001_bom_and_mutations.sql","202610010002_login_users.sql","202610130002_conflict_no_retry.sql"])await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),"utf8"));
  await db.query("insert into auth.users values($1),($2)",[admin,operator]);
  await db.query("insert into profiles(user_id,display_name,role) values($1,'管理者','admin'),($2,'担当者','operator')",[admin,operator]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
  const save=(expected:number)=>db.query("select public.manage_entity('product',$1,$2)",[JSON.stringify({name:"検証",customer:"",notes:"",dueDate:"2026-10-30",archived:false}),expected]);
  await assert.rejects(()=>save(0),(error:unknown)=>(error as {code?:string}).code==="PT409");
  assert.equal((await db.query<{revision:number}>("select revision from schedule_state")).rows[0].revision,1);
  assert.equal((await db.query<{count:number}>("select count(*)::int count from products")).rows[0].count,0);
  await save(1);assert.equal((await db.query<{revision:number}>("select revision from schedule_state")).rows[0].revision,2);
  await assert.rejects(()=>save(1),(error:unknown)=>(error as {code?:string}).code==="PT409");
  await db.exec(`set request.jwt.claim.sub='${operator}'`);await assert.rejects(()=>save(2),/管理者/);
  await db.exec("set request.jwt.claim.sub=''");await assert.rejects(()=>save(2),(error:unknown)=>(error as {code?:string}).code==="42501");
  await db.exec("reset role");
  await assert.rejects(()=>db.query("select public.register_login_profile($1,$2,'追加','operator',1)",[randomUUID(),admin]),(error:unknown)=>(error as {code?:string}).code==="PT409");
 }finally{await db.close();}
});
