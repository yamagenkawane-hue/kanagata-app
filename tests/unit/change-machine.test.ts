import test from "node:test";
import assert from "node:assert/strict";
import {createDemo} from "../../src/domain/demo.ts";
import {changeMachine} from "../../src/domain/change-machine.ts";
import {taskConflicts} from "../../src/domain/planning.ts";

test("machine transfer works for an empty machine and a busy machine without mutating input",()=>{
 const data=createDemo();const source=data.tasks.find(task=>task.process==="wire"&&task.status==="pending"&&!task.fixed)!;
 const empty=data.equipment.find(machine=>machine.process==="wire"&&!data.tasks.some(task=>task.equipmentId===machine.id))!;
 const original=structuredClone(data);
 const moved=changeMachine(data,source.id,empty.id,source.plannedStart);
 assert.equal(moved.tasks.find(task=>task.id===source.id)!.equipmentId,empty.id);
 assert.equal(taskConflicts(moved.tasks).length,0);assert.deepEqual(data,original);
 const busy=data.equipment.find(machine=>machine.process==="wire"&&machine.id!==source.equipmentId&&data.tasks.some(task=>task.equipmentId===machine.id))!;
 const result=changeMachine(data,source.id,busy.id,source.plannedStart);
 assert.equal(result.tasks.find(task=>task.id===source.id)!.equipmentId,busy.id);
 assert.equal(taskConflicts(result.tasks).length,0);
 const next=result.tasks.find(task=>task.partId===source.partId&&task.process==="assembly");
 if(next)assert.ok(Date.parse(next.plannedStart)>=Date.parse(result.tasks.find(task=>task.id===source.id)!.plannedEnd));
});
test("different process, stopped machines and protected tasks reject transfer",()=>{
 const data=createDemo();const source=data.tasks.find(task=>task.process==="wire"&&task.status==="pending"&&!task.fixed)!;
 const target=data.equipment.find(machine=>machine.process==="wire"&&machine.id!==source.equipmentId)!;
 assert.throws(()=>changeMachine(data,source.id,data.equipment.find(machine=>machine.process==="machining")!.id,source.plannedStart));
 assert.throws(()=>changeMachine({...data,equipment:data.equipment.map(machine=>machine.id===target.id?{...machine,active:false}:machine)},source.id,target.id,source.plannedStart));
 for(const patch of [{fixed:true},{status:"running" as const},{actualStart:source.plannedStart}])assert.throws(()=>changeMachine({...data,tasks:data.tasks.map(task=>task.id===source.id?{...task,...patch}:task)},source.id,target.id,source.plannedStart));
});
