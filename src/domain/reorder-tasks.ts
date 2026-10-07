import { movePriority, placeAtRequestedStart, PROCESSES, type PlanData, type Task } from "./planning.ts";

export function canReorderTask(task:Task):boolean {
 return Boolean(task.equipmentId) && task.status==="pending" && !task.fixed;
}

export function canMoveTask(task:Task):boolean { return task.status==="pending"&&!task.fixed; }

// Keep unrelated machine jobs in their slots while rearranging the matching
// plates/parts of this mold in every subsequent manufacturing queue.
export function propagateOrder(data:PlanData,tasks:Task[],sourceId:string):Task[] {
 const source=tasks.find(task=>task.id===sourceId)!;
 const owner=data.parts.find(part=>part.id===source.partId);
 if(!owner||!source.equipmentId)return tasks;
 const ordered=tasks.filter(task=>task.process===source.process&&task.equipmentId===source.equipmentId&&canReorderTask(task)&&data.parts.some(part=>part.id===task.partId&&part.productId===owner.productId)).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 const ranks=new Map(ordered.map((task,index)=>[task.partId,index]));
 let result=tasks;
 for(const equipment of data.equipment.filter(machine=>PROCESSES.findIndex(process=>process.code===machine.process)>PROCESSES.findIndex(process=>process.code===source.process))){
  const queue=result.filter(task=>task.equipmentId===equipment.id&&task.status==="pending").sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const slots=queue.map((task,index)=>canReorderTask(task)&&ranks.has(task.partId)?index:-1).filter(index=>index>=0);
  const matching=slots.map(index=>queue[index]).sort((a,b)=>ranks.get(a.partId)!-ranks.get(b.partId)!);
  const newRanks=new Map(matching.map((task,index)=>[task.id,slots[index]+1]));
  result=result.map(task=>newRanks.has(task.id)?{...task,priority:newRanks.get(task.id)!}:task);
 }
 return result;
}

export function moveTaskInTime(data:PlanData,sourceId:string,start:string):PlanData {
 const source=data.tasks.find(task=>task.id===sourceId);
 if(!source||!canMoveTask(source))throw new Error("移動できるのは固定されていない未着手の予定です。");
 const placed=placeAtRequestedStart({...source,earliestStart:start},data.calendar);
 let tasks=data.tasks.map(task=>task.id===sourceId?placed:task);
 if(source.equipmentId){
  const queue=tasks.filter(task=>task.id!==sourceId&&task.equipmentId===source.equipmentId&&task.status==="pending").sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const next=queue.findIndex(task=>Date.parse(task.plannedStart)>=Date.parse(placed.plannedStart));
  tasks=movePriority(tasks,sourceId,next<0?queue.length+1:next+1);
 }
 return {...data,tasks:propagateOrder(data,tasks,sourceId)};
}

export function reorderTasks(tasks:Task[],sourceId:string,targetId:string,after:boolean):Task[] {
 const source=tasks.find(task=>task.id===sourceId),target=tasks.find(task=>task.id===targetId);
 if(!source||!target||!canReorderTask(source)||!canReorderTask(target))throw new Error("順番を変更できるのは固定されていない未着手の加工予定です。");
 if(source.equipmentId!==target.equipmentId)throw new Error("同じ機械のバーへドロップしてください。");
 if(sourceId===targetId)return tasks;
 const queue=tasks.filter(task=>task.equipmentId===source.equipmentId && task.status==="pending" && task.id!==sourceId).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 const rank=queue.findIndex(task=>task.id===targetId)+1+(after?1:0);
 return movePriority(tasks,sourceId,rank);
}
