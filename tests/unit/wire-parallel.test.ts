import test from "node:test";
import assert from "node:assert/strict";
import {at,schedule,taskConflicts,type PlanData,type Task} from "../../src/domain/planning.ts";
import {availableStarts} from "../../src/domain/available-starts.ts";

test("wire machines can process different parts at the same time, with the same planned worker",()=>{
 const day="2026-10-14",start=at(day,540);
 const task=(id:string,machine:string):Task=>({id,partId:id,process:"wire",equipmentId:machine,workerId:"w",duration:60,earliestStart:start,priority:1,status:"pending",fixed:false,overnight:false,breakRun:false,plannedStart:start,plannedEnd:at(day,600),segments:[{start,end:at(day,600)}]});
 const data:PlanData={products:[{id:"p",name:"金型",customer:"",dueDate:day,notes:""}],parts:["a","b"].map(id=>({id,productId:"p",name:id,quantity:1,drawingNumber:"",processes:["wire"]})),equipment:[{id:"wire1",name:"ワイヤー1",process:"wire"},{id:"wire2",name:"ワイヤー2",process:"wire"}],workers:[{id:"w",name:"担当"}],tasks:[task("a","wire1"),task("b","wire2")],calendar:{[day]:true},logs:[],revision:1};
 const tasks=schedule(data,30);
 assert.equal(tasks[0].plannedStart,start);assert.equal(tasks[1].plannedStart,start);
 assert.equal(taskConflicts(tasks).length,0);
 assert.ok(availableStarts(day,data.tasks[1],data).includes(`${day}T09:00`));
 const duplicate={...tasks[1],equipmentId:"wire1"};
 assert.equal(taskConflicts([tasks[0],duplicate]).length,1);
 assert.ok(!availableStarts(day,duplicate,{...data,tasks:[tasks[0]]}).includes(`${day}T09:00`));
});
