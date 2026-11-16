import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {addStagePlans,stageCandidates} from '../../src/domain/bom-stage-plans.ts';
import {schedule,type PlanData} from '../../src/domain/planning.ts';

test('工程別BOM: マシニング一括保存、研磨個別追加、重複拒否、数量と前後関係を維持',async()=>{
 const db=new PGlite();const admin=randomUUID();
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
 for(const file of ['202609300001_initial_schema.sql','202610010001_bom_and_mutations.sql','202610050001_bom_categories.sql','202610050002_bom_names.sql','202610050003_task_days.sql','202610050004_mold_processes.sql','202610050005_press_no.sql','202610070001_trial_next_day.sql','20261116093312_staged_bom_plans.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query("insert into auth.users values($1)",[admin]);
 await db.query("insert into public.profiles(user_id,display_name,role) values($1,'admin','admin')",[admin]);
 await db.exec("set request.jwt.claim.sub='"+admin+"'");
 await db.query('select public.seed_test_data((select revision from public.schedule_state where id=true))');
 const read=async()=>(await db.query<{data:PlanData}>('select public.read_planning() data')).rows[0].data;
 let data=await read();const product=data.products[0].id;
 // Existing seeded plans stay untouched; add two new plate types to this mold.
 await db.query("insert into public.bom_items(product_id,name,kind,quantity,notes,processes) values($1,'stageA','plate',1,'',array['machining','grinding','wire']),($1,'stageB','plate',1,'',array['machining','grinding','wire'])",[product]);
 data=await read();
 const options=(process:string)=>({equipmentId:data.equipment.find(e=>e.process===process)!.id,workerId:admin,start:'2026-10-01T00:00:00.000Z',overnight:true});
 const choices=stageCandidates(data,product,'machining',true);
 assert.equal(choices.length,2);
 let candidate=addStagePlans(data,product,'machining',choices.map(c=>({key:c.key,duration:60})),options('machining'));
 candidate={...candidate,tasks:schedule(candidate,30)};
 await db.query('select public.commit_plan($1,$2,false)',[JSON.stringify(candidate),data.revision]);
 data=await read();const count=data.parts.length;
 assert.equal(stageCandidates(data,product,'machining',true).length,0);
 const grinding=stageCandidates(data,product,'grinding',true);
 assert.equal(grinding.length,2);
 const selection={key:grinding[0].key,duration:60};
 candidate=addStagePlans(data,product,'grinding',[selection],options('grinding'));
 candidate={...candidate,tasks:schedule(candidate,30)};
 await db.query('select public.commit_plan($1,$2,false)',[JSON.stringify(candidate),data.revision]);
 data=await read();
 assert.equal(data.parts.length,count);
 assert.equal(stageCandidates(data,product,'grinding',true).length,1);
 const previous=data.tasks.find(t=>t.partId===selection.key&&t.process==='machining')!;
 const next=data.tasks.find(t=>t.partId===selection.key&&t.process==='grinding')!;
 assert.ok(next.plannedStart>=previous.plannedEnd);
 assert.throws(()=>addStagePlans(data,product,'grinding',[selection],options('grinding')),/登録済み/);
 assert.throws(()=>addStagePlans(data,product,'wire',[{key:selection.key,duration:31}],options('wire')),/30分/);
 }finally{await db.close();}
});

