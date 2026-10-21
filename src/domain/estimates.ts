import {schedule,processCatalog,type BomItem,type PlanData,type Task} from "./planning.ts";
import {remainingQuantity} from "./business.ts";

export type EstimateSettings={machiningMinutes:number;grindingMinutes:number;largeGrindingMinutes:number;wireMinutes:number;largeThresholdMm:number};
export const DEFAULT_ESTIMATES:EstimateSettings={machiningMinutes:240,grindingMinutes:240,largeGrindingMinutes:480,wireMinutes:480,largeThresholdMm:300};
export function estimateMinutes(item:BomItem,process:string,quantity:number,settings:EstimateSettings=DEFAULT_ESTIMATES){
 if(item.kind!=="plate"||!item.widthMm||!item.lengthMm)throw new Error(`${item.name}の幅・長さをBOM設定に登録してください。`);
 if(!Number.isInteger(quantity)||quantity<1)throw new Error("数量を確認してください。");
 const per=process==="machining"?settings.machiningMinutes:process==="wire"?settings.wireMinutes:process==="grinding"?(Math.max(item.widthMm,item.lengthMm)>settings.largeThresholdMm?settings.largeGrindingMinutes:settings.grindingMinutes):undefined;
 if(!per)throw new Error("追加工程は個別に所要時間を指定してください。");
 const result=per*quantity;if(result>525600)throw new Error("加工時間が上限を超えます。数量を分けてください。");return result;
}

// Register one plate per lot so separate machines can process them in parallel.
export function autoPlatePlans(data:PlanData,productId:string,start:string,workerId:string,overnight=false):PlanData{
 if(!Number.isFinite(Date.parse(start)))throw new Error("開始可能日時を入力してください。");
 if(!data.workers.some(worker=>worker.id===workerId&&worker.active!==false))throw new Error("担当者を選択してください。");
 const items=data.bom?.filter(item=>item.productId===productId&&item.kind==="plate"&&!item.archived&&item.processes.length&&remainingQuantity(data,item.id)>0)??[];
 if(!items.length)throw new Error("自動登録できる未登録プレートがありません。");
 let count=0;for(const item of items){count+=remainingQuantity(data,item.id);for(const process of item.processes)estimateMinutes(item,process,1,data.estimates??DEFAULT_ESTIMATES);}
 if(count>100||data.parts.length+count>2000)throw new Error("一括登録は100枚までです。数量を分けて登録してください。");
 let candidate:PlanData={...data,parts:[...data.parts],tasks:data.tasks.map(task=>task.status==="pending"&&!task.fixed?{...task,earliestStart:new Date(Math.max(Date.parse(task.earliestStart),Date.parse(task.plannedStart))).toISOString()}:task)};
 for(const item of items)for(let n=0;n<remainingQuantity(data,item.id);n++){
  const partId=crypto.randomUUID();candidate={...candidate,parts:[...candidate.parts,{id:partId,productId,bomId:item.id,name:item.name,quantity:1,drawingNumber:"",processes:[]}]};
  const required=processCatalog(data).filter(process=>item.processes.includes(process.code));
  for(const process of required){
   const machines=data.equipment.filter(machine=>machine.process===process.code&&machine.active!==false);
   if(!machines.length)throw new Error(`${process.name}の有効な機械がありません。`);
   let best:PlanData|undefined;let end=Infinity;let cause:unknown;
   const taskId=crypto.randomUUID();
   for(const machine of machines){
    const task:Task={id:taskId,partId,process:process.code,equipmentId:machine.id,workerId,duration:estimateMinutes(item,process.code,1,data.estimates??DEFAULT_ESTIMATES),earliestStart:start,priority:candidate.tasks.filter(t=>t.equipmentId===machine.id&&t.status==="pending").length+1,status:"pending",fixed:false,overnight,breakRun:true,plannedStart:"",plannedEnd:"",segments:[]};
    const attempt={...candidate,parts:candidate.parts.map(part=>part.id===partId?{...part,processes:[...(part.processes??[]),process.code]}:part),tasks:[...candidate.tasks,task]};
    try{const tasks=schedule(attempt,30);const finish=Date.parse(tasks.find(t=>t.id===taskId)!.plannedEnd);if(finish<end){best={...attempt,tasks};end=finish;}}catch(error){cause=error;}
   }
   if(!best)throw cause??new Error("予定を配置できません。");candidate=best;
  }
 }
 // Avoid reporting unchanged start requests on original tasks as edits.
 return {...candidate,tasks:candidate.tasks.map(task=>{const old=data.tasks.find(t=>t.id===task.id);return old?{...task,earliestStart:old.earliestStart}:task;})};
}
