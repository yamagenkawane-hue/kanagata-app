import test from "node:test";
import assert from "node:assert/strict";
import {autoPlatePlans,estimateMinutes,DEFAULT_ESTIMATES} from "../../src/domain/estimates.ts";
import {addDays,at,taskConflicts,type PlanData,type BomItem} from "../../src/domain/planning.ts";
import {masterSchemas} from "../../src/domain/business.ts";

const item:BomItem={id:"b",productId:"p",kind:"plate",name:"PP",quantity:2,notes:"",processes:["machining","grinding","wire"],archived:false,widthMm:100,lengthMm:230};
function fixture():PlanData{return {products:[{id:"p",name:"金型",customer:"",dueDate:"2026-11-01",notes:""}],bom:[item],parts:[],tasks:[],workers:[{id:"w",name:"担当"}],equipment:["machining","grinding","wire"].flatMap(process=>[1,2].map(n=>({id:`${process}${n}`,name:`${process}${n}`,process}))),calendar:Object.fromEntries(Array.from({length:30},(_,n)=>[addDays("2026-10-21",n),true])),logs:[],revision:1};}
test("estimates use long side, strict 300 boundary, quantity and editable settings",()=>{
 assert.equal(estimateMinutes(item,"machining",1),240);assert.equal(estimateMinutes(item,"wire",1),480);
 assert.equal(estimateMinutes({...item,widthMm:230,lengthMm:100},"grinding",1),240);
 assert.equal(estimateMinutes({...item,lengthMm:300},"grinding",1),240);
 assert.equal(estimateMinutes({...item,lengthMm:301},"grinding",1),480);
 assert.equal(estimateMinutes({...item,widthMm:400},"machining",2),480);
 assert.equal(estimateMinutes(item,"wire",2,{...DEFAULT_ESTIMATES,wireMinutes:300}),600);
 assert.throws(()=>estimateMinutes({...item,widthMm:null},"machining",1),/幅・長さ/);
 assert.equal(masterSchemas.estimates.safeParse({...DEFAULT_ESTIMATES,wireMinutes:31}).success,false);
});
test("automatic registration splits quantities, picks free machines, preserves input and avoids duplicates",()=>{
 const data=fixture(),before=structuredClone(data);const result=autoPlatePlans(data,"p",at("2026-10-21",540),"w");
 assert.equal(result.parts.length,2);assert.equal(result.tasks.length,6);assert.equal(taskConflicts(result.tasks).length,0);assert.deepEqual(data,before);
 const machining=result.tasks.filter(task=>task.process==="machining");assert.equal(machining[0].plannedStart,machining[1].plannedStart);assert.notEqual(machining[0].equipmentId,machining[1].equipmentId);
 for(const part of result.parts){const tasks=result.tasks.filter(task=>task.partId===part.id);assert.deepEqual(tasks.map(task=>task.duration),[240,240,480]);assert.ok(Date.parse(tasks[1].plannedStart)>=Date.parse(tasks[0].plannedEnd));}
 assert.throws(()=>autoPlatePlans(result,"p",at("2026-10-21",540),"w"),/未登録/);
 assert.throws(()=>autoPlatePlans({...data,bom:[{...item,lengthMm:null}]},"p",at("2026-10-21",540),"w"),/幅・長さ/);
 assert.throws(()=>autoPlatePlans({...data,equipment:[]},"p",at("2026-10-21",540),"w"),/機械/);

});
