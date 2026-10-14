import test from "node:test";
import assert from "node:assert/strict";
import {adjustOverduePlans} from "../../src/domain/overdue-plans.ts";
import {at,localInput,taskConflicts,type PlanData,type Task} from "../../src/domain/planning.ts";

const day="2026-10-14";
function task(id:string,partId:string,process:string,machine:string,start:number,end:number,priority:number):Task{return {id,partId,process,equipmentId:machine,workerId:"w",duration:60,earliestStart:at(day,start),plannedStart:at(day,start),plannedEnd:at(day,end),segments:[{start:at(day,start),end:at(day,end)}],priority,status:"pending",fixed:false,breakRun:false,overnight:false};}
function fixture():PlanData{return {products:[{id:"p",name:"金型A",customer:"",dueDate:day,notes:""},{id:"q",name:"金型B",customer:"",dueDate:day,notes:""}],parts:[{id:"a",productId:"p",name:"A",quantity:1,drawingNumber:"",processes:["machining","wire"]},{id:"b",productId:"q",name:"B",quantity:1,drawingNumber:"",processes:["machining"]}],equipment:[{id:"mc",name:"MC",process:"machining"},{id:"wire",name:"WIRE",process:"wire"}],workers:[{id:"w",name:"担当"}],tasks:[task("a-mc","a","machining","mc",540,600,1),task("a-wire","a","wire","wire",600,660,1),task("b-mc","b","machining","mc",600,660,2)],calendar:{[day]:true,"2026-10-15":true,"2026-10-16":false,"2026-10-17":true},logs:[],revision:1};}
test("overdue shift cascades to next process and another mold sharing equipment, and is idempotent",()=>{
 const data=fixture();const before=structuredClone(data);const now=Date.parse(at(day,615));
 const result=adjustOverduePlans(data,now);
 assert.equal(localInput(result.data.tasks[0].plannedStart).slice(11),"10:00");
 assert.equal(localInput(result.data.tasks[1].plannedStart).slice(11),"11:00");
 assert.equal(localInput(result.data.tasks[2].plannedStart).slice(11),"11:00");
 assert.equal(result.changed.length,3);assert.equal(taskConflicts(result.data.tasks).length,0);
 assert.deepEqual(data,before);assert.equal(adjustOverduePlans(result.data,now).changed.length,0);
});
test("hourly increments repeat until end is future even across a lunch window",()=>{
 const data=fixture();data.parts=data.parts.slice(0,1).map(part=>({...part,processes:["machining"]}));data.tasks=[{...task("a-mc","a","machining","mc",710,790,1),duration:30,segments:[{start:at(day,710),end:at(day,720)},{start:at(day,770),end:at(day,790)}]}];
 const result=adjustOverduePlans(data,Date.parse(at(day,810)));
 assert.ok(Date.parse(result.data.tasks[0].plannedEnd)>Date.parse(at(day,810)));
 assert.equal(localInput(result.data.tasks[0].plannedStart).slice(11),"14:00");
});
test("worked, fixed and completed plans are never moved and no overdue plans produce no changes",()=>{
 const data=fixture();data.tasks[0].status="completed";data.tasks[0].actualStart=data.tasks[0].plannedStart;data.tasks[0].actualEnd=data.tasks[0].plannedEnd;data.tasks[1].fixed=true;data.tasks[2].actualStart=data.tasks[2].plannedStart;
 assert.equal(adjustOverduePlans(data,Date.parse(at(day,1000))).changed.length,0);
 assert.equal(adjustOverduePlans(fixture(),Date.parse(at(day,550))).changed.length,0);
});
test("missing company calendar fails without modifying the plan",()=>{
 const data=fixture();data.calendar={};const before=structuredClone(data);
 assert.throws(()=>adjustOverduePlans(data,Date.parse(at(day,615))),/カレンダー/);assert.deepEqual(data,before);
});
