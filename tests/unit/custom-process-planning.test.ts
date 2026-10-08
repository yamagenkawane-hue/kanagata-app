import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { at, dateKey, schedule, type PlanData, type Task } from "../../src/domain/planning.ts";
import { propagateOrder } from "../../src/domain/reorder-tasks.ts";

test("custom stages precede mold assembly/trial and follow upstream plate order",()=>{
 const code=`custom_${randomUUID()}`;const other=`custom_${randomUUID()}`;
 const initial=at("2026-10-05",530);
 const make=(id:string,partId:string,process:string,equipmentId:string,priority:number):Task=>({id,partId,process,equipmentId,workerId:"w",duration:process==="assembly"||process==="trial"?470:60,earliestStart:initial,priority,status:"pending",overnight:false,breakRun:false,fixed:false,plannedStart:"",plannedEnd:"",segments:[]});
 const data:PlanData={processes:[{code,name:"仕上げ",order:40,color:"#527c87",tint:"#e3eff2"},{code:other,name:"検査",order:50,color:"#527c87",tint:"#e3eff2"}],products:[{id:"p",name:"金型",customer:"",notes:"",dueDate:"2026-10-30"}],parts:[{id:"a",productId:"p",name:"A",quantity:1,drawingNumber:"",processes:["wire",code,other]},{id:"b",productId:"p",name:"B",quantity:1,drawingNumber:"",processes:["wire",code,other]},{id:"m",productId:"p",scope:"mold",name:"型組",quantity:1,drawingNumber:"",processes:["assembly"]},{id:"t",productId:"p",scope:"mold",name:"トライ",quantity:1,drawingNumber:"",processes:["trial"]}],equipment:[{id:"wire",process:"wire",name:"WIRE"},{id:"custom",process:code,name:"仕上げ"},{id:"inspect",process:other,name:"検査"}],workers:[{id:"w",name:"担当"}],calendar:Object.fromEntries(Array.from({length:25},(_,i)=>[`2026-10-${String(i+5).padStart(2,"0")}`,true])),tasks:[make("a-wire","a","wire","wire",2),make("b-wire","b","wire","wire",1),make("a-custom","a",code,"custom",1),make("b-custom","b",code,"custom",2),make("a-inspect","a",other,"inspect",1),make("b-inspect","b",other,"inspect",2),make("assembly","m","assembly","",1),make("trial","t","trial","",1)],logs:[],revision:1};
 data.tasks=propagateOrder(data,data.tasks,"b-wire");
 assert.equal(data.tasks.find(t=>t.id==="b-custom")!.priority,1);assert.equal(data.tasks.find(t=>t.id==="b-inspect")!.priority,1);
 const result=schedule(data,30);const assembly=result.find(t=>t.id==="assembly")!;const trial=result.find(t=>t.id==="trial")!;
 for(const task of result.filter(t=>!["assembly","trial"].includes(t.process)))assert.ok(Date.parse(assembly.plannedStart)>=Date.parse(task.plannedEnd));
 assert.ok(dateKey(trial.plannedStart)>dateKey(assembly.plannedEnd));
 const invalid={...data,parts:data.parts.map(part=>part.id==="a"?{...part,processes:["unregistered"]}:part)};
 assert.throws(()=>schedule(invalid,30),/未登録/);
});
