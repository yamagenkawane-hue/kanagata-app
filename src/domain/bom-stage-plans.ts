import { remainingQuantity } from './business.ts';
import { estimateMinutes } from './estimates.ts';
import { bomProcessCatalog, type PlanData, type Task } from './planning.ts';

export function stageCandidates(data: PlanData, productId: string, process: string, platesOnly: boolean) {
  return (data.bom ?? []).filter(b => !b.archived && b.productId === productId && (!platesOnly || b.kind === 'plate') && b.processes.includes(process)).flatMap(b => {
    const existing = data.parts.filter(p => !p.archived && p.bomId === b.id && (p.processes ?? b.processes).includes(process) && !data.tasks.some(t => t.partId === p.id && t.process === process));
    return [...existing.map(p => ({key:p.id, bom:b, part:p, quantity:p.quantity})), ...(remainingQuantity(data,b.id)>0 ? [{key:`new:${b.id}`,bom:b,part:undefined,quantity:remainingQuantity(data,b.id)}] : [])];
  });
}

export function addStagePlans(data:PlanData, productId:string, process:string, selections:{key:string;duration:number}[], options:{equipmentId:string;workerId:string;start:string;overnight:boolean}):PlanData {
  if(!data.products.some(p=>p.id===productId&&!p.archived))throw new Error('金型を選択してください。');
  if(!data.equipment.some(e=>e.id===options.equipmentId&&e.process===process&&e.active!==false))throw new Error('工程に対応する設備を選択してください。');
  if(!data.workers.some(w=>w.id===options.workerId&&w.active!==false)||!Number.isFinite(Date.parse(options.start)))throw new Error('担当者・開始可能日時を確認してください。');
  if(!selections.length||selections.length>100||new Set(selections.map(s=>s.key)).size!==selections.length)throw new Error('登録対象を1〜100件選択してください。');
  const candidates=stageCandidates(data,productId,process,false);
  const result={...data,parts:[...data.parts],tasks:[...data.tasks]};
  for(const selection of selections){
    const entry=candidates.find(c=>c.key===selection.key);
    if(!entry)throw new Error('登録済み、または対象外の工程です。画面を更新してください。');
    if(!Number.isInteger(selection.duration)||selection.duration<30||selection.duration>525600||selection.duration%30)throw new Error('所要時間は30分単位で指定してください。');
    const part=entry.part??{id:crypto.randomUUID(),productId,bomId:entry.bom.id,name:entry.bom.name,quantity:entry.quantity,drawingNumber:'',processes:bomProcessCatalog(data).filter(p=>entry.bom.processes.includes(p.code)).map(p=>p.code)};
    if(!entry.part)result.parts.push(part);
    const task:Task={id:crypto.randomUUID(),partId:part.id,process,equipmentId:options.equipmentId,workerId:options.workerId,duration:selection.duration,earliestStart:options.start,priority:result.tasks.filter(t=>t.equipmentId===options.equipmentId&&t.status==='pending').length+1,status:'pending',overnight:options.overnight,breakRun:true,fixed:false,plannedStart:'',plannedEnd:'',segments:[]};
    result.tasks.push(task);
  }
  return result;
}

export function stageEstimate(entry:ReturnType<typeof stageCandidates>[number],process:string,data:PlanData){
  try{return estimateMinutes(entry.bom,process,entry.quantity,data.estimates);}catch{return 60;}
}
