import {renumber,movePriority,schedule,type PlanData} from "./planning.ts";
import {propagateOrder} from "./reorder-tasks.ts";

export function changeMachine(data:PlanData,id:string,equipmentId:string,start:string):PlanData{
 const source=data.tasks.find(task=>task.id===id);
 const machine=data.equipment.find(item=>item.id===equipmentId);
 if(!source||!source.equipmentId||source.status!=="pending"||source.fixed||source.actualStart||data.logs.some(log=>log.taskId===id))throw new Error("機械変更は実績のない、固定されていない未着手予定だけです。");
 if(!machine||machine.active===false||machine.process!==source.process)throw new Error("同じ工程の稼働中の機械へ移動してください。");
 if(!Number.isFinite(Date.parse(start)))throw new Error("移動先の日時が不正です。");
 const queue=data.tasks.filter(task=>task.id!==id&&task.equipmentId===equipmentId&&task.status==="pending").sort((a,b)=>a.priority-b.priority);
 const rank=queue.filter(task=>Date.parse(task.plannedStart)<Date.parse(start)).length+1;
 let tasks=data.tasks.map(task=>task.id===id?{...task,equipmentId,earliestStart:start,priority:queue.length+1,manualOverride:false}:task.status==="pending"&&!task.fixed?{...task,earliestStart:new Date(Math.max(Date.parse(task.earliestStart),Date.parse(task.plannedStart))).toISOString()}:task);
 tasks=renumber(renumber(tasks,source.equipmentId),equipmentId);
 tasks=movePriority(tasks,id,rank);
 tasks=propagateOrder(data,tasks,id);
 return {...data,tasks:schedule({...data,tasks},30).map(task=>task.id===id?task:{...task,earliestStart:data.tasks.find(old=>old.id===task.id)!.earliestStart})};
}
