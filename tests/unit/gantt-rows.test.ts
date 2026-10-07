import test from "node:test";
import assert from "node:assert/strict";
import { ganttRows } from "../../src/domain/gantt-rows.ts";
import { at, type Task } from "../../src/domain/planning.ts";

function task(id:string,start:number,end:number,equipmentId="MC1",process:Task["process"]="machining"):Task {
 return {id,partId:id,process,equipmentId,workerId:"worker",duration:end-start,earliestStart:at("2026-10-07",start),priority:1,status:"pending",overnight:false,breakRun:false,fixed:false,plannedStart:at("2026-10-07",start),plannedEnd:at("2026-10-07",end),segments:[{start:at("2026-10-07",start),end:at("2026-10-07",end)}]};
}

test("DB1 8:50-9:50 and DP 9:50-10:50 share one machine row without changing tasks",()=>{
 const db1=task("DB1",530,590),dp=task("DP",590,650);const input=[dp,db1],before=structuredClone(input);
 const rows=ganttRows(input);assert.equal(rows.length,1);assert.deepEqual(rows[0].tasks.map(task=>task.id),["DB1","DP"]);assert.deepEqual(input,before);
});

test("different machines remain separate and overlapping bars stay selectable",()=>{
 const rows=ganttRows([task("DB1",530,590),task("overlap",560,620),task("DP",620,680),task("MC2part",530,590,"MC2")]);
 assert.equal(rows.length,3);assert.deepEqual(rows.flatMap(row=>row.tasks.map(task=>task.id)).sort(),["DB1","DP","MC2part","overlap"]);
 for(const row of rows)for(let i=1;i<row.tasks.length;i++)assert.ok(Date.parse(row.tasks[i-1].plannedEnd)<=Date.parse(row.tasks[i].plannedStart));
});

test("processes retain machining, grinding, wire, assembly and trial order",()=>{
 const codes=["trial","wire","assembly","grinding","machining"] as const;
 const rows=ganttRows(codes.map(code=>task(code,530,590,code==="assembly"||code==="trial"?"":code,code)));
 assert.deepEqual(rows.map(row=>row.tasks[0].process),["machining","grinding","wire","assembly","trial"]);
});
