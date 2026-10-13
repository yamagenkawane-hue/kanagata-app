import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

function normalized(value:Record<string,unknown>):Record<string,unknown>{
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,Array.isArray(item)?[...item].sort((a,b)=>String(a.id??a.code).localeCompare(String(b.id??b.code))):item]));
}
test("optimized read preserves snapshots, authorization and optional custom catalog; compares read latency",async()=>{
 const db=new PGlite();const admin=randomUUID();
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
  for(const file of ["202609300001_initial_schema.sql","202610010001_bom_and_mutations.sql","202610050001_bom_categories.sql","202610050002_bom_names.sql","202610050003_task_days.sql","202610050004_mold_processes.sql","202610050005_press_no.sql","202610070001_trial_next_day.sql"])await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),"utf8"));
  await db.query("insert into auth.users values($1)",[admin]);await db.query("insert into profiles(user_id,display_name,role) values($1,'管理者','admin')",[admin]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
  const read=async()=>(await db.query<{value:Record<string,unknown>}>("select public.read_planning() value")).rows[0].value;
  await db.query("select public.seed_test_data($1)",[(await read()).revision]);
  const before=await read();
  const measure=async()=>{await read();const start=performance.now();for(let i=0;i<20;i++)await read();return (performance.now()-start)/20;};
  const oldMs=await measure();
  const sql=await readFile(new URL("../../supabase/migrations/202610130001_read_planning_optimized.sql",import.meta.url),"utf8");
  await db.exec("reset role");await db.exec(sql);await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
  assert.deepEqual(normalized(await read()),normalized(before));
  const newMs=await measure();console.log(JSON.stringify({benchmark:"PGlite 20 reads average ms, not production CPU",before:Math.round(oldMs*100)/100,after:Math.round(newMs*100)/100}));
  await db.exec("set request.jwt.claim.sub=''");await assert.rejects(()=>read(),/有効な利用者/);
  await db.exec("set role anon");await assert.rejects(()=>read(),/permission/);
  await db.exec("reset role");await db.exec(await readFile(new URL("../../supabase/migrations/202610080001_custom_processes.sql",import.meta.url),"utf8"));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
  await db.query("select public.manage_entity('process',$1,$2)",[JSON.stringify({name:"追加工程",active:true}),(await read()).revision]);
  const withCatalog=await read();await db.exec("reset role");await db.exec(sql);await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
  assert.deepEqual(normalized(await read()),normalized(withCatalog));
 }finally{await db.close();}
});
