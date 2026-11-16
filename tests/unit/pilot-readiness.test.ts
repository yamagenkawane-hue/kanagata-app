import test from "node:test";
import assert from "node:assert/strict";
import {createDemo} from "../../src/domain/demo.ts";
import {pilotReadiness} from "../../src/domain/pilot-readiness.ts";
import {addDays} from "../../src/domain/planning.ts";

test("readiness distinguishes missing calendar from explicit holidays and does not modify data",()=>{
 const data=createDemo();const today="2026-11-13";
 for(let index=0;index<31;index++)data.calendar[addDays(today,index)]=false;
 const before=structuredClone(data);
 assert.equal(pilotReadiness(data,today).find(check=>check.id==="calendar")!.status,"ok");
 assert.deepEqual(data,before);
 delete data.calendar[addDays(today,7)];
 assert.equal(pilotReadiness(data,today).find(check=>check.id==="calendar")!.status,"blocked");
});
test("readiness catches absent machines, missing stages and exceeding BOM quantity",()=>{
 const data=createDemo();data.equipment=data.equipment.map(machine=>({...machine,active:false}));
 data.tasks=data.tasks.filter(task=>task.id!==data.tasks[0].id);
 const bom=data.bom![0];data.parts.push({...data.parts.find(part=>part.bomId===bom.id)!,id:"too-many",bomId:bom.id,quantity:bom.quantity+1});
 const checks=pilotReadiness(data,"2026-11-13"); assert.equal(checks.find(check=>check.id==="processes")!.status,"warning");
 for(const id of ["machines","quantity"])assert.equal(checks.find(check=>check.id===id)!.status,"blocked",id);
});
