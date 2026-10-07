import test from "node:test";
import assert from "node:assert/strict";
import { reorderTasks } from "../../src/domain/reorder-tasks.ts";
import { createDemo } from "../../src/domain/demo.ts";
import { schedule, at, type Task } from "../../src/domain/planning.ts";
function task(id:string,priority:number):Task{return {id,partId:id,process:"machining",equipmentId:"m",workerId:"w",duration:60,earliestStart:at("2026-10-07",530),priority,status:"pending",overnight:false,breakRun:false,fixed:false,plannedStart:"",plannedEnd:"",segments:[]};}
function order(tasks:Task[]){return [...tasks].sort((a,b)=>a.priority-b.priority).map(task=>task.id);}
test("drop before and after renumbers a machine queue without mutating the source",()=>{
 const tasks=[task("a",1),task("b",2),task("c",3)],original=structuredClone(tasks);
 assert.deepEqual(order(reorderTasks(tasks,"c","a",false)),["c","a","b"]);
 assert.deepEqual(order(reorderTasks(tasks,"a","c",true)),["b","c","a"]);
 assert.deepEqual(order(reorderTasks(tasks,"a","b",false)),["a","b","c"]);
 assert.deepEqual(tasks,original);
});
test("other machines, fixed tasks and worked tasks cannot be reordered",()=>{
 const a=task("a",1),b=task("b",2);
 for(const changed of [{...b,equipmentId:"other"},{...b,fixed:true},{...b,status:"running" as const},{...b,status:"completed" as const}])assert.throws(()=>reorderTasks([a,changed],"a","b",false));
 assert.throws(()=>reorderTasks([{...a,fixed:true},b],"a","b",false));
});
test("reordered priorities are used when recalculating downstream processes",()=>{
 const data=createDemo();const queue=data.tasks.filter(task=>task.process==="machining"&&task.status==="pending"&&!task.fixed).sort((a,b)=>a.priority-b.priority);
 const first=queue[0],last=queue.filter(task=>task.equipmentId===first.equipmentId).at(-1)!;
 assert.notEqual(first.id,last.id);
 data.tasks=reorderTasks(data.tasks,last.id,first.id,false);
 const tasks=schedule(data),moved=tasks.find(task=>task.id===last.id)!;
 assert.equal(moved.priority,1);assert.ok(Date.parse(moved.plannedEnd)<=Date.parse(tasks.find(task=>task.id===first.id)!.plannedStart));
 for(const dependent of tasks.filter(task=>task.partId===moved.partId&&task.process!=="machining"))assert.ok(Date.parse(dependent.plannedStart)>=Date.parse(moved.plannedEnd));
});
