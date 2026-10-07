import { movePriority, type Task } from "./planning.ts";

export function canReorderTask(task:Task):boolean {
 return Boolean(task.equipmentId) && task.status==="pending" && !task.fixed;
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
