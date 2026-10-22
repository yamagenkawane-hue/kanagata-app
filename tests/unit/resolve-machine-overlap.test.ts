import test from "node:test";
import assert from "node:assert/strict";
import {resolveMachineOverlap} from "../../src/domain/resolve-machine-overlap.ts";
import {at,taskConflicts,type PlanData,type Task} from "../../src/domain/planning.ts";
function source():PlanData{
 const task=(id:string,start:number,end:number,status:Task["status"],process="grinding",equipmentId="G"):Task=>({id,partId:id==="next"?"b":id,process,equipmentId,workerId:"worker",duration:60,earliestStart:at("2026-10-22",start),plannedStart:at("2026-10-22",start),plannedEnd:at("2026-10-22",start+60),priority:id==="a"?1:2,status,overnight:false,breakRun:false,fixed:false,segments:[{start:at("2026-10-22",start),end:at("2026-10-22",start+60)}],...(status==="completed"?{actualStart:at("2026-10-22",start),actualEnd:at("2026-10-22",end)}:{})});
 return {revision:1,products:[{id:"m",name:"金型",customer:"",dueDate:"2026-10-30",notes:""}],parts:[{id:"a",productId:"m",name:"DB1",quantity:1,drawingNumber:"",processes:["grinding"]},{id:"b",productId:"m",name:"DP",quantity:1,drawingNumber:"",processes:["grinding","wire"]}],workers:[{id:"worker",name:"担当"}],equipment:[{id:"G",name:"自動研磨",process:"grinding"},{id:"W",name:"ワイヤー",process:"wire"}],calendar:{"2026-10-22":true,"2026-10-23":true,"2026-10-24":false,"2026-10-25":false,"2026-10-26":true},tasks:[task("a",900,1020,"completed"),task("b",960,1080,"completed"),task("next",540,600,"pending","wire","W")],logs:[{id:"log",taskId:"b",workerId:"worker",start:at("2026-10-22",960),end:at("2026-10-22",1080),calculatedMinutes:120,reason:"",breaks:[[720,770],[900,910]],editedBy:"担当"}]};
}
test("priority shifts completed actual and history together, preserves elapsed duration and recalculates downstream",()=>{
 const input=source(),before=structuredClone(input);const {data}=resolveMachineOverlap(input,"a","b");
 const shifted=data.tasks.find(task=>task.id==="b")!;
 assert.equal(shifted.actualStart,at("2026-10-22",1020));assert.equal(shifted.actualEnd,at("2026-10-22",1140));
 assert.equal(data.logs[0].start,shifted.actualStart);assert.equal(data.logs[0].end,shifted.actualEnd);
 assert.ok(Date.parse(data.tasks.find(task=>task.id==="next")!.plannedStart)>=Date.parse(shifted.actualEnd!));
 assert.deepEqual(data.tasks.find(task=>task.id==="a"),input.tasks[0]);assert.deepEqual(input,before);assert.equal(taskConflicts(data.tasks).length,0);
});
test("reverse priority, multiple logs and invalid pair validation",()=>{
 const input=source();const resolved=resolveMachineOverlap(input,"b","a").data;
 assert.equal(resolved.tasks.find(task=>task.id==="a")!.actualStart,at("2026-10-22",1080));
 input.logs.push({...input.logs[0],id:"log2",start:at("2026-10-22",970),end:at("2026-10-22",980),overrideMinutes:9});
 const shifted=resolveMachineOverlap(input,"a","b").data;
 assert.equal(shifted.logs[1].overrideMinutes,9);assert.equal(Date.parse(shifted.logs[1].start)-Date.parse(input.logs[1].start),3600000);
 assert.throws(()=>resolveMachineOverlap(input,"a","next"),/同じ機械/);
});
test("pending overlap can reverse machine priority while keeping the selected winner at its original start",()=>{
 const input=source();input.logs=[];
 input.tasks=input.tasks.map(task=>task.id==="a"?{...task,status:"pending",actualStart:undefined,actualEnd:undefined}:task.id==="b"?{...task,status:"pending",actualStart:undefined,actualEnd:undefined,earliestStart:at("2026-10-22",930),plannedStart:at("2026-10-22",930),plannedEnd:at("2026-10-22",990),segments:[{start:at("2026-10-22",930),end:at("2026-10-22",990)}]}:task);
 const result=resolveMachineOverlap(input,"b","a").data;
 assert.equal(result.tasks.find(task=>task.id==="b")!.plannedStart,at("2026-10-22",930));
 assert.equal(result.tasks.find(task=>task.id==="a")!.plannedStart,at("2026-10-22",990));
 assert.equal(taskConflicts(result.tasks).length,0);
});
