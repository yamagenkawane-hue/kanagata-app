import test from "node:test";
import assert from "node:assert/strict";
import { reorderTasks, moveTaskInTime, propagateOrder, moveConflicts, resolveTimeMove } from "../../src/domain/reorder-tasks.ts";
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

test("moving start time changes the machine order and synchronizes subsequent process queues",()=>{
 const tasks=[task("a",1),task("b",2),task("c",3)];
 tasks.forEach((task,index)=>{task.plannedStart=at("2026-10-07",530+60*index);task.plannedEnd=at("2026-10-07",590+60*index);task.segments=[{start:task.plannedStart,end:task.plannedEnd}];});
 const downstream=tasks.map((task,index)=>({...task,id:`g-${task.id}`,process:"grinding" as const,equipmentId:"g",priority:3-index}));
 const data={revision:1,products:[{id:"p",name:"mold",customer:"",dueDate:"2026-10-20",notes:""}],parts:tasks.map(task=>({id:task.partId,productId:"p",name:task.id,quantity:1,drawingNumber:"",processes:["machining","grinding"] as ("machining"|"grinding")[]})),equipment:[{id:"m",name:"MC",process:"machining" as const},{id:"g",name:"grinding",process:"grinding" as const}],workers:[{id:"w",name:"worker"}],tasks:[...tasks,...downstream],logs:[],calendar:{"2026-10-07":true,"2026-10-08":true}};
 const before=structuredClone(data);const candidate=moveTaskInTime(data,"a",at("2026-10-07",710));
 assert.deepEqual(order(candidate.tasks.filter(task=>task.process==="machining")),["b","c","a"]);
 assert.deepEqual(order(candidate.tasks.filter(task=>task.process==="grinding")),["g-b","g-c","g-a"]);
 const planned=schedule(candidate);assert.equal(planned.find(task=>task.id==="a")!.plannedStart,at("2026-10-07",710));
 assert.ok(Date.parse(planned.find(task=>task.id==="g-a")!.plannedStart)>=Date.parse(planned.find(task=>task.id==="a")!.plannedEnd));
 assert.deepEqual(data,before);
 assert.throws(()=>moveTaskInTime({...data,tasks:data.tasks.map(task=>task.id==="a"?{...task,fixed:true}:task)},"a",at("2026-10-07",710)));
});

test("propagation preserves fixed and unrelated tasks and their assigned machine",()=>{
 const a=task("a",2),b=task("b",1),ga={...a,id:"ga",equipmentId:"g",process:"grinding" as const,priority:1},gb={...b,id:"gb",equipmentId:"g",process:"grinding" as const,priority:3},other={...task("other",2),equipmentId:"g",process:"grinding" as const};
 const data={...createDemo(),parts:[{id:"a",productId:"p",name:"a",quantity:1,drawingNumber:""},{id:"b",productId:"p",name:"b",quantity:1,drawingNumber:""}],equipment:[{id:"g",name:"g",process:"grinding" as const}]};
 const result=propagateOrder(data,[a,b,ga,other,gb],"a");assert.equal(result.find(task=>task.id==="gb")!.priority,1);assert.equal(result.find(task=>task.id==="ga")!.priority,3);assert.deepEqual(result.find(task=>task.id==="other"),other);
 const fixed={...ga,fixed:true};assert.deepEqual(propagateOrder(data,[a,b,fixed,other,gb],"a").find(task=>task.id==="ga"),fixed);
});

test("overlapping drag offers distinct shift and swap results, preserving a delay for every following job",()=>{
 const jobs=[task("a",1),task("b",2),task("c",3)];jobs.forEach((task,index)=>{task.plannedStart=at("2026-10-07",530+index*60);task.plannedEnd=at("2026-10-07",590+index*60);task.segments=[{start:task.plannedStart,end:task.plannedEnd}];});
 const data={...createDemo(),tasks:jobs,parts:jobs.map(task=>({id:task.partId,productId:"p",name:task.id,quantity:1,drawingNumber:"",processes:["machining"] as "machining"[]})),products:[{id:"p",name:"mold",customer:"",dueDate:"2026-10-20",notes:""}],equipment:[{id:"m",name:"m",process:"machining" as const}],workers:[{id:"w",name:"w"}],calendar:{"2026-10-07":true,"2026-10-08":true}};
 assert.deepEqual(moveConflicts(data,"a",at("2026-10-07",590)).map(task=>task.id),["b"]);
 const shifted=resolveTimeMove(data,"a",at("2026-10-07",590),"shift");
 assert.deepEqual(order(shifted.tasks),["a","b","c"]);
 assert.equal(shifted.tasks.find(task=>task.id==="b")!.earliestStart,at("2026-10-07",650));
 assert.equal(shifted.tasks.find(task=>task.id==="c")!.earliestStart,at("2026-10-07",710));
 assert.deepEqual(schedule(shifted).map(task=>task.plannedStart),[at("2026-10-07",590),at("2026-10-07",650),at("2026-10-07",710)]);
 const swapped=schedule(resolveTimeMove(data,"a",at("2026-10-07",590),"swap","b"));
 assert.deepEqual(order(swapped),["b","a","c"]);assert.equal(swapped.find(task=>task.id==="b")!.plannedStart,at("2026-10-07",530));
 const fixed={...data,tasks:jobs.map(task=>task.id==="b"?{...task,fixed:true}:task)};
 assert.throws(()=>resolveTimeMove(fixed,"a",at("2026-10-07",590),"swap","b"));
 assert.deepEqual(resolveTimeMove(fixed,"a",at("2026-10-07",590),"shift").tasks.find(task=>task.id==="b"),fixed.tasks[1]);
});
