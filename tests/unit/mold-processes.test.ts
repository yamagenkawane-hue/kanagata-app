import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createDemo } from "../../src/domain/demo.ts";
import { schedule, at, taskConflicts, type PlanData, type Task } from "../../src/domain/planning.ts";
import { activePlan, masterSchemas } from "../../src/domain/business.ts";

function append(data: PlanData, process: "assembly" | "trial", productId: string, withoutEquipment = false) {
  const partId = randomUUID(), equipmentId = withoutEquipment ? "" : data.equipment.find(item => item.process === process)!.id;
  const task: Task = { id: randomUUID(), partId, process, equipmentId, workerId: data.workers[0].id, duration: 470, earliestStart: at("2026-10-05", 530), priority: data.tasks.filter(item => item.equipmentId === equipmentId).length + 1, status: "pending", overnight: false, breakRun: false, fixed: false, plannedStart: "", plannedEnd: "", segments: [] };
  const candidate: PlanData = { ...data, parts: [...data.parts, { id: partId, productId, scope: "mold", name: process, quantity: 1, drawingNumber: "", processes: [process] }], tasks: [...data.tasks, task] };
  candidate.tasks = schedule(candidate);
  return candidate;
}

test("BOM rejects assembly/trial; mold tasks follow every part and each other", () => {
  assert.equal(masterSchemas.bom.safeParse({ productId: randomUUID(), name: "部品", kind: "part", quantity: 1, notes: "", processes: ["assembly"], archived: false }).success, false);
  let data = createDemo();
  data.parts = data.parts.filter(part => part.scope !== "mold").map(part => ({ ...part, processes: ["machining", "grinding", "wire"] }));
  data.tasks = data.tasks.filter(task => !["assembly", "trial"].includes(task.process));
  data = append(data, "assembly", data.products[0].id);
  data = append(data, "trial", data.products[0].id);
  const moldTasks = data.tasks.filter(task => data.parts.find(part => part.id === task.partId)?.scope === "mold");
  const assembly = moldTasks.find(task => task.process === "assembly")!, trial = moldTasks.find(task => task.process === "trial")!;
  for (const task of data.tasks.filter(task => data.parts.find(part => part.id === task.partId)?.productId === data.products[0].id && !moldTasks.includes(task))) assert.ok(Date.parse(assembly.plannedStart) >= Date.parse(task.actualEnd ?? task.plannedEnd));
  assert.ok(Date.parse(trial.plannedStart) >= Date.parse(assembly.plannedEnd));
});

test("DB migration preserves legacy tasks; independent CRUD and dependencies are enforced", async () => {
  const db = new PGlite(), admin = randomUUID();
  try {
    await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
    for (const file of ["202609300001_initial_schema.sql", "202610010001_bom_and_mutations.sql", "202610050001_bom_categories.sql", "202610050002_bom_names.sql", "202610050003_task_days.sql"]) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
    await db.query("insert into auth.users values($1)", [admin]);
    await db.query("insert into public.profiles(user_id,display_name,role) values($1,'管理者','admin')", [admin]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}';`);
    await db.query("select public.seed_test_data(1)");
    const read = async () => (await db.query<{ value: PlanData }>("select public.read_planning() value")).rows[0].value;
    const before = await read();
    await db.exec("reset role");
    await db.exec(await readFile(new URL("../../supabase/migrations/202610050004_mold_processes.sql", import.meta.url), "utf8"));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}';`);
    let data = await read();
    assert.deepEqual(data.tasks, before.tasks);
    assert.ok(data.bom!.every(item => item.processes.every(code => !["assembly", "trial"].includes(code))));
    const productId = data.products[0].id;
    const save = async (candidate: PlanData) => db.query("select public.commit_plan($1,$2,true)", [JSON.stringify({ parts: candidate.parts, tasks: candidate.tasks }), data.revision]);
    const assembly = append(data, "assembly", productId);
    await save(assembly); data = await read();
    assert.equal(data.parts.filter(part => part.scope === "mold").length, 1);
    await assert.rejects(() => save(append(data, "assembly", productId)), /parts_unique_mold_process/);
    assert.equal((await read()).revision, data.revision);
    const trial = append(data, "trial", productId);
    const trialTask = trial.tasks.find(task => trial.parts.find(part => part.id === task.partId)?.scope === "mold" && task.process === "trial")!;
    const invalidDays = structuredClone(trial);
    invalidDays.tasks.find(task => task.id === trialTask.id)!.duration = 60;
    await assert.rejects(() => save(invalidDays), /整数日数/);
    const invalid = structuredClone(trial);
    const target = invalid.tasks.find(task => task.id === trialTask.id)!;
    target.plannedStart = at("2026-10-05", 530); target.plannedEnd = at("2026-10-05", 1000); target.segments = [{ start: target.plannedStart, end: target.plannedEnd }];
    await assert.rejects(() => save(invalid), /先行工程/);
    await save(trial); data = await read();
    await db.exec("reset role");
    const operator = randomUUID();
    await db.query("insert into auth.users values($1)", [operator]);
    await db.query("insert into public.profiles(user_id,display_name,role) values($1,'担当者','operator')", [operator]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${operator}';`);
    await assert.rejects(() => save(data), /管理者/);
    await db.exec(`set request.jwt.claim.sub='${admin}';`);
    const part = data.parts.find(part => part.scope === "mold" && part.processes?.includes("trial"))!;
    await db.query("select public.manage_entity('part',$1,$2)", [JSON.stringify({ id: part.id, name: "トライ", archived: true }), data.revision]);
    data = await read(); assert.equal(data.parts.find(item => item.id === part.id)!.archived, true);
    await db.exec("reset role");
    await db.exec(await readFile(new URL("../../supabase/migrations/202610050005_press_no.sql", import.meta.url), "utf8"));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}';`);
    data = await read();
    for (const task of data.tasks.filter(task => data.parts.find(part => part.id === task.partId)?.scope === "mold")) assert.equal(task.equipmentId, "");
    await db.exec("reset role");
    await db.exec(await readFile(new URL("../../supabase/migrations/202610070001_trial_next_day.sql", import.meta.url), "utf8"));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}';`);
    data = await read();
    const noEquipment = append(activePlan(data), "trial", productId, true);
    const newTrial = noEquipment.tasks.at(-1)!; newTrial.pressNo = "PRESS-07";
    await save(noEquipment); data = await read();
    assert.equal(data.tasks.find(task => task.id === newTrial.id)!.pressNo, "PRESS-07");
    assert.equal(data.tasks.find(task => task.id === newTrial.id)!.equipmentId, "");
    const sameDay=structuredClone(activePlan(data));
    const assemblyEnd=sameDay.tasks.find(task=>task.process==="assembly" && sameDay.parts.some(part=>part.id===task.partId && part.scope==="mold" && part.productId===productId))!.plannedEnd;
    const invalidTrial=sameDay.tasks.find(task=>task.id===newTrial.id)!;
    invalidTrial.plannedStart=assemblyEnd;invalidTrial.plannedEnd=new Date(Date.parse(assemblyEnd)+470*60_000).toISOString();invalidTrial.segments=[{start:invalidTrial.plannedStart,end:invalidTrial.plannedEnd}];
    await assert.rejects(()=>save(sameDay),/翌日以降/);
    assert.equal((await read()).revision,data.revision);
    const updated = structuredClone(activePlan(data));
    updated.tasks.find(task => task.id === newTrial.id)!.pressNo = "";
    await save(updated); data = await read();
    assert.equal(data.tasks.find(task => task.id === newTrial.id)!.pressNo, "");
    const invalidEquipment = structuredClone(activePlan(data));
    invalidEquipment.tasks.find(task => task.id === newTrial.id)!.equipmentId = data.equipment.find(item => item.process === "trial")!.id;
    await assert.rejects(() => save(invalidEquipment), /設備の指定は不要/);
  } finally { await db.close(); }
});

test("mold processes need no equipment and do not share an equipment queue", () => {
  const data = createDemo();
  data.equipment = data.equipment.filter(item => !["assembly", "trial"].includes(item.process));
  const tasks = schedule(data);
  assert.equal(taskConflicts(tasks).length, 0);
  assert.ok(tasks.filter(task => ["assembly", "trial"].includes(task.process)).every(task => task.equipmentId === ""));
});

test("trial begins on a working day after the scheduled assembly end, even when actual completion was earlier",()=>{
 const assembly:Task={id:"assembly",partId:"a",process:"assembly",equipmentId:"",workerId:"w",duration:470,earliestStart:at("2026-10-09",530),priority:1,status:"completed",overnight:false,breakRun:false,fixed:false,plannedStart:at("2026-10-09",530),plannedEnd:at("2026-10-09",640),actualStart:at("2026-10-08",530),actualEnd:at("2026-10-08",640),segments:[{start:at("2026-10-09",530),end:at("2026-10-09",640)}]};
 const trial:Task={...assembly,id:"trial",partId:"t",process:"trial",status:"pending",actualStart:undefined,actualEnd:undefined,plannedStart:"",plannedEnd:"",segments:[]};
 const data:PlanData={revision:1,products:[{id:"p",name:"mold",customer:"",dueDate:"2026-10-20",notes:""}],parts:[{id:"a",productId:"p",scope:"mold",name:"assembly",quantity:1,drawingNumber:"",processes:["assembly"]},{id:"t",productId:"p",scope:"mold",name:"trial",quantity:1,drawingNumber:"",processes:["trial"]}],equipment:[],workers:[{id:"w",name:"worker"}],tasks:[assembly,trial],logs:[],calendar:{"2026-10-09":true,"2026-10-10":false,"2026-10-11":false,"2026-10-12":true}};
 assert.equal(schedule(data).find(task=>task.id==="trial")!.plannedStart,at("2026-10-12",530));
 data.tasks[1]={...trial,fixed:true,plannedStart:at("2026-10-09",770),plannedEnd:at("2026-10-12",770),segments:[{start:at("2026-10-09",770),end:at("2026-10-09",900)}]};
 assert.throws(()=>schedule(data),/固定予定/);
});
