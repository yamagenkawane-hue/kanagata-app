import {schedule,type PlanData} from "./planning.ts";
import {reorderTasks,propagateOrder,canReorderTask} from "./reorder-tasks.ts";

export function reorderList(data:PlanData,sourceId:string,targetId:string,after:boolean):PlanData{
 const source=data.tasks.find(task=>task.id===sourceId),target=data.tasks.find(task=>task.id===targetId);
 if(!source||!target||sourceId===targetId)return data;
 if([source,target].some(task=>task.actualStart||data.logs.some(log=>log.taskId===task.id)))throw new Error("実績登録済みの予定は並べ替えできません。");
 let tasks=reorderTasks(data.tasks,sourceId,targetId,after);
 const min=Math.min(source.priority,target.priority),max=Math.max(source.priority,target.priority);
 const affected=data.tasks.filter(task=>task.equipmentId===source.equipmentId&&canReorderTask(task)&&task.priority>=min&&task.priority<=max);
 const start=new Date(Math.min(...affected.map(task=>Date.parse(task.plannedStart)))).toISOString();
 const ids=new Set(affected.map(task=>task.id));
 tasks=tasks.map(task=>ids.has(task.id)?{...task,earliestStart:start}:task);
 tasks=propagateOrder(data,tasks,sourceId);
 return {...data,tasks:schedule({...data,tasks},30)};
}
